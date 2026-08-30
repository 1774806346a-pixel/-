import { z } from "zod";
import type { Asset, AssetAppearance, AssetKind, ScreenplayVersion } from "../../domain/models";
import type { ModelAdapter } from "../model/model-adapter";
import { runGeneration } from "../model/generation-runner";
import { parseModelJson } from "../model/json-output";
import { mergePromptLayers } from "../prompts/prompt-layers";
import { createAssetAnalysisPromptLayers } from "../prompts/asset-prompts";
import { assetNameFor } from "../../domain/rules/asset-naming";
import { extractProjectAssets } from "./asset-extraction-service";

const appearanceSchema = z.object({ episode: z.number().int().positive(), scene: z.string().trim().min(1) }).passthrough();
const candidateSchema = z.object({ kind: z.enum(["scene", "character", "prop"]), displayName: z.string().trim().min(1), description: z.string().trim().min(1), aliases: z.array(z.string().trim().min(1)).default([]), firstAppearance: appearanceSchema, appearances: z.array(appearanceSchema).default([]), worthProducing: z.boolean().default(true) });
const responseSchema = z.object({ assets: z.array(candidateSchema) });
type MergeCandidate = { kind: Exclude<AssetKind, "ui">; displayName: string; description: string; aliases: string[]; firstAppearance: AssetAppearance; appearances: AssetAppearance[]; worthProducing: boolean };

export interface ModelAssetAnalysisResult { assets: Asset[]; warnings: string[]; usedModel: boolean; }

function stableId(projectId: string, kind: AssetKind, name: string): string { return `${projectId}:asset:${kind}:${name}`; }

function mergeAssets(base: readonly Asset[], candidates: readonly MergeCandidate[], projectId: string): Asset[] {
  const map = new Map(base.filter((asset) => asset.kind !== "ui").map((asset) => [`${asset.kind}:${asset.name}`, { ...asset, appearances: [...asset.appearances], aliases: [...asset.aliases] }]));
  for (const candidate of candidates.filter((item) => item.worthProducing)) {
    const name = assetNameFor(candidate.kind, candidate.displayName);
    const key = `${candidate.kind}:${name}`;
    const existing = map.get(key);
    if (existing) {
      existing.description = candidate.description.length > existing.description.length ? candidate.description : existing.description;
      existing.aliases = [...new Set([...existing.aliases, ...candidate.aliases])];
      existing.appearances = [...existing.appearances, candidate.firstAppearance, ...candidate.appearances].filter((item, index, all) => index === all.findIndex((other) => JSON.stringify(other) === JSON.stringify(item)));
    } else {
      map.set(key, { id: stableId(projectId, candidate.kind, name), projectId, schemaVersion: 1, kind: candidate.kind, name, displayName: candidate.displayName, description: candidate.description, firstAppearance: candidate.firstAppearance, appearances: [...new Set([candidate.firstAppearance, ...candidate.appearances].map((item) => JSON.stringify(item)))].map((item) => JSON.parse(item)), aliases: candidate.aliases, locked: false });
    }
  }
  return [...map.values()];
}

export async function analyzeProjectAssets(adapter: ModelAdapter, screenplays: readonly ScreenplayVersion[], existingAssets: readonly Asset[] = [], signal?: AbortSignal): Promise<ModelAssetAnalysisResult> {
  const deterministic = extractProjectAssets(screenplays).assets;
  const baseline = mergeAssets(existingAssets, deterministic.filter((asset): asset is Asset & { kind: Exclude<AssetKind, "ui"> } => asset.kind !== "ui").map((asset) => ({ kind: asset.kind, displayName: asset.displayName, description: asset.description, aliases: asset.aliases, firstAppearance: asset.firstAppearance, appearances: asset.appearances, worthProducing: true })), screenplays[0]?.projectId ?? existingAssets[0]?.projectId ?? "project");
  const mergedPrompt = mergePromptLayers(createAssetAnalysisPromptLayers(screenplays, baseline));
  try {
    const generation = await runGeneration(adapter, { taskType: "assets", systemPrompt: mergedPrompt.systemPrompt, userPrompt: mergedPrompt.userPrompt, responseSchema: { type: "object", properties: { assets: { type: "array" } }, required: ["assets"] }, timeoutMs: 120_000 }, { signal });
    const parsed = responseSchema.safeParse(parseModelJson(generation.text));
    if (!parsed.success) return { assets: baseline, warnings: ["模型资产结果格式无效，已保留规则提取结果"], usedModel: false };
    return { assets: mergeAssets(baseline, parsed.data.assets, screenplays[0]?.projectId ?? existingAssets[0]?.projectId ?? "project"), warnings: [], usedModel: true };
  } catch (error) {
    return { assets: baseline, warnings: [error instanceof Error ? error.message : String(error)], usedModel: false };
  }
}
