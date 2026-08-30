import type { ScreenplayMetadata, ScreenplayVersion } from "../../domain/models";
import { screenplaySchema } from "../../domain/schemas/screenplay.schema";
import type { ModelAdapter } from "../model/model-adapter";
import { runGeneration } from "../model/generation-runner";
import { createScreenplayPromptLayers, type AdaptationPromptOptions } from "../prompts/screenplay-prompts";
import { mergePromptLayers } from "../prompts/prompt-layers";
import { validateNoInvention } from "../../domain/rules/no-invention-rules";
import { validateScreenplayFormat } from "../../domain/rules/screenplay-format-rules";
import { renderScreenplayMarkdown } from "../renderers/screenplay-markdown-renderer";
import type { SourceVoiceLedgerEntry } from "./source-voice-ledger";
import { parseModelJson } from "../model/json-output";

export interface AdaptScreenplayRequest extends AdaptationPromptOptions {
  readonly projectId: string;
  readonly adapter: ModelAdapter;
  readonly sourceVersionId?: string | null;
  readonly parentVersionId?: string | null;
  readonly sourceVersion?: ScreenplayVersion;
  readonly protectedVoices?: readonly SourceVoiceLedgerEntry[];
  readonly signal?: AbortSignal;
}

export interface AdaptScreenplayResult {
  readonly version: ScreenplayVersion;
  readonly promptVersion: string;
  readonly generationText: string;
}

const id = (prefix: string) => globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const now = () => new Date().toISOString();

export function normalizeScreenplayCandidate(candidate: Record<string, unknown>, request: AdaptScreenplayRequest): ScreenplayVersion {
  const timestamp = now();
  const metadata = {
    title: String((candidate.metadata as Partial<ScreenplayMetadata> | undefined)?.title ?? request.metadata.genre ?? "短剧"),
    genre: request.metadata.genre,
    elements: [],
    episodeCount: request.metadata.episodeCount,
    episodeDurationSeconds: request.metadata.episodeDurationSeconds,
    oneLineSynopsis: request.source.slice(0, 120) || "短剧分集剧本",
    comparableWorks: [],
    audience: request.metadata.audience,
    ...((candidate.metadata ?? {}) as Partial<ScreenplayMetadata>),
  } as ScreenplayMetadata;
  const scenes = Array.isArray(candidate.scenes) ? candidate.scenes as ScreenplayVersion["scenes"] : [];
  const characters = Array.isArray(candidate.characters) ? candidate.characters as ScreenplayVersion["characters"] : [];
  const normalizedScenes = scenes.map((scene, index) => ({ ...scene, id: scene.id || id("scene"), sequence: scene.sequence || index + 1, characters: scene.characters ?? [], actions: scene.actions ?? [], dialogues: scene.dialogues ?? [] }));
  const normalizedCharacters = characters.map((character) => ({ ...character, id: character.id || id("character") }));
  const version = {
    id: id("screenplay"), projectId: request.projectId, schemaVersion: 1 as const, versionNumber: 1,
    title: String(candidate.title ?? metadata.title ?? "未命名剧本"), sourceVersionId: request.sourceVersionId ?? null, parentVersionId: request.parentVersionId ?? null,
    status: "draft" as const, metadata, characters: normalizedCharacters, scenes: normalizedScenes,
    adaptationHandling: candidate.adaptationHandling ?? { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] },
    qualitySelfCheck: candidate.qualitySelfCheck ?? { sceneCount: normalizedScenes.length, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 0, suspenseStrength: 0, endingHook: "待补充" },
    createdAt: timestamp, updatedAt: timestamp,
    ...(request.episodeNumber === undefined ? {} : { episodeNumber: request.episodeNumber }),
    ...(request.entryType ? { entryType: request.entryType } : {}),
  } as ScreenplayVersion;
  version.qualitySelfCheck = { ...version.qualitySelfCheck, sceneCount: version.scenes.length };
  version.bodyMarkdown = renderScreenplayMarkdown(version);
  return version;
}

function normalizeRawScreenplay(raw: string, request: AdaptScreenplayRequest): ScreenplayVersion {
  const timestamp = now();
  const episode = request.episodeNumber ?? 1;
  const metadata: ScreenplayMetadata = { title: request.metadata.genre || "短剧", genre: request.metadata.genre || "短剧", elements: [], episodeCount: request.metadata.episodeCount, episodeDurationSeconds: request.metadata.episodeDurationSeconds, oneLineSynopsis: request.source.slice(0, 120) || "短剧分集剧本", comparableWorks: [], audience: request.metadata.audience };
  const version = { id: id("screenplay"), projectId: request.projectId, schemaVersion: 1 as const, versionNumber: 1, title: metadata.title, sourceVersionId: request.sourceVersionId ?? null, parentVersionId: request.parentVersionId ?? null, status: "draft" as const, metadata, characters: [{ id: id("character"), name: "剧本", identity: "文本", appearance: "", personality: "" }], scenes: [{ id: id("scene"), sequence: 1, header: { location: "未指定", timeOfDay: "unspecified" as const, setting: "unspecified" as const }, characters: ["剧本"], actions: [{ type: "action" as const, subject: "剧本", description: "原始 Markdown 输出已保留在正文中" }], dialogues: [] }], adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] }, qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: raw.length, suspenseStrength: 0, endingHook: "请查看正文结尾" }, createdAt: timestamp, updatedAt: timestamp, episodeNumber: episode, ...(request.entryType ? { entryType: request.entryType } : {}) } as ScreenplayVersion;
  version.bodyMarkdown = raw.trim();
  return version;
}

export class ScreenplayAdaptationService {
  async adapt(request: AdaptScreenplayRequest): Promise<AdaptScreenplayResult> {
    const merged = mergePromptLayers(createScreenplayPromptLayers(request));
    const generation = await runGeneration(request.adapter, { taskType: "screenplay", systemPrompt: merged.systemPrompt, userPrompt: merged.userPrompt, timeoutMs: 120_000 }, { signal: request.signal });
    let parsed: unknown = generation.value;
    if (parsed === undefined) {
      try { parsed = parseModelJson(generation.text); } catch { return { version: normalizeRawScreenplay(generation.text, request), promptVersion: merged.promptVersion, generationText: generation.text }; }
    }
    const version = normalizeScreenplayCandidate(parsed as Record<string, unknown>, request);
    const schema = screenplaySchema.safeParse(version);
    if (!schema.success) throw new Error(`Screenplay schema validation failed: ${schema.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    const format = validateScreenplayFormat(version);
    if (!format.valid) throw new Error(`Screenplay format validation failed: ${format.issues.map((issue) => issue.path).join(", ")}`);
    const protection = validateNoInvention(version, { lockedFacts: request.lockedFacts, sourceVersion: request.sourceVersion, protectedVoices: request.protectedVoices });
    if (!protection.valid) throw new Error(`Screenplay contains prohibited inventions: ${protection.violations.map((item) => item.value).join(", ")}`);
    return { version, promptVersion: merged.promptVersion, generationText: generation.text };
  }
}

export function createScreenplayAdaptationService(): ScreenplayAdaptationService { return new ScreenplayAdaptationService(); }
