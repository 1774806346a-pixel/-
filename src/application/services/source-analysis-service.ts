import type { ParsedNode } from "./screenplay-parser";
import { parseScreenplayMarkdown } from "./screenplay-parser";
import type { ModelAdapter } from "../model/model-adapter";
import { runGeneration } from "../model/generation-runner";
import { ModelError } from "../model/model-errors";
import { createSourceAnalysisPromptLayers } from "../prompts/intake-prompts";
import { mergePromptLayers } from "../prompts/prompt-layers";
import { sourceAnalysisSchema, type SourceAnalysis } from "../../domain/schemas/intake.schema";

export type SourceInputType = "novel" | "chapter" | "outline" | "screenplay" | "template" | "free-text";
export interface SourceAnalysisRequest { input: string; inputType?: SourceInputType; adapter?: ModelAdapter; signal?: AbortSignal; }
export interface SourceAnalysisResult { analysis: SourceAnalysis; promptVersion?: string; generationText?: string; deterministic: boolean; }

export class SourceAnalysisService {
  async analyze(request: SourceAnalysisRequest): Promise<SourceAnalysisResult> {
    if (!request.input.trim()) throw new Error("Source input cannot be empty");
    const inputType = request.inputType ?? "free-text";
    if (inputType === "screenplay") return { analysis: buildScreenplayAnalysis(request.input), deterministic: true };
    if (!request.adapter) throw new Error("A model adapter is required for novel or free-text analysis");
    const merged = mergePromptLayers(createSourceAnalysisPromptLayers(request.input, inputType === "template" ? "free-text" : inputType));
    const generation = await runGeneration(request.adapter, { taskType: "custom", systemPrompt: merged.systemPrompt, userPrompt: merged.userPrompt, responseSchema: {}, timeoutMs: 120_000 }, { signal: request.signal });
    const value = generation.value ?? parseJson(generation.text);
    const parsed = sourceAnalysisSchema.safeParse({ ...value as Record<string, unknown>, schemaVersion: 1, inputType, modelMetadata: { provider: request.adapter.provider, modelName: request.adapter.modelName, promptVersion: merged.promptVersion, generatedAt: new Date().toISOString() } });
    if (!parsed.success) throw new ModelError("schema-invalid", `Source analysis schema validation failed: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`, { retryable: false });
    return { analysis: parsed.data, promptVersion: merged.promptVersion, generationText: generation.text, deterministic: false };
  }
}

function buildScreenplayAnalysis(input: string): SourceAnalysis {
  const parsed = parseScreenplayMarkdown(input);
  const dialogues = parsed.nodes.filter((node) => ["dialogue", "inner-thought", "vo", "os"].includes(node.type) && node.speaker).map((node) => ({ speaker: node.speaker!, text: node.text, sourceLocation: node.location }));
  const actions = parsed.nodes.filter((node) => node.type === "action").map((node) => ({ description: node.text, sourceLocation: node.location }));
  const characters = [...new Set(dialogues.map((line) => line.speaker))].map((name) => ({ name, sourceLocation: parsed.nodes.find((node) => node.speaker === name)?.location }));
  const structureNodes = parsed.nodes.filter((node) => node.type === "episode" || node.type === "scene" || node.type === "unknown").map((node, index) => ({ id: node.sceneId ?? `${node.type}-${index + 1}`, type: node.type, title: node.text || node.type, sourceLocation: node.location, needsReview: node.type === "unknown" }));
  const pendingConfirmations = parsed.unknownNodes.map((node) => ({ description: node.text, sourceLocation: node.location }));
  return sourceAnalysisSchema.parse({ schemaVersion: 1, inputType: "screenplay", summary: parsed.metadata.map((node) => node.text).join("\n") || "Screenplay source analysis", characters, conflicts: [], events: [], structureNodes, dialogue: dialogues, actions, pendingConfirmations, sourceLocations: parsed.nodes.map((node) => node.location), modelMetadata: {} });
}

function parseJson(text: string): unknown { try { return JSON.parse(text); } catch { const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]; const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1); try { return JSON.parse(candidate); } catch (error) { throw new ModelError("schema-invalid", "原稿分析返回不是合法 JSON，请重试", { retryable: false, cause: error }); } } }

export function createSourceAnalysisService(): SourceAnalysisService { return new SourceAnalysisService(); }
