import { ideaDiagnosisSchema, type IdeaDiagnosis } from "../../domain/schemas/intake.schema";
import type { ModelAdapter } from "../model/model-adapter";
import { runGeneration } from "../model/generation-runner";
import { ModelError } from "../model/model-errors";
import { createIdeaDiagnosisPromptLayers } from "../prompts/intake-prompts";
import { mergePromptLayers } from "../prompts/prompt-layers";

export interface IdeaDiagnosisRequest { input: string; adapter: ModelAdapter; signal?: AbortSignal; }
export interface IdeaDiagnosisResult { diagnosis: IdeaDiagnosis; promptVersion: string; generationText: string; }

export class IdeaDiagnosisService {
  async diagnose(request: IdeaDiagnosisRequest): Promise<IdeaDiagnosisResult> {
    if (!request.input.trim()) throw new Error("Idea input cannot be empty");
    const merged = mergePromptLayers(createIdeaDiagnosisPromptLayers(request.input));
    const generation = await runGeneration(request.adapter, { taskType: "custom", systemPrompt: merged.systemPrompt, userPrompt: merged.userPrompt, responseSchema: {}, timeoutMs: 120_000 }, { signal: request.signal });
    const value = generation.value ?? parseJson(generation.text);
    const parsed = ideaDiagnosisSchema.safeParse({ ...value as Record<string, unknown>, schemaVersion: 1, inputType: "idea", modelMetadata: { provider: request.adapter.provider, modelName: request.adapter.modelName, promptVersion: merged.promptVersion, generatedAt: new Date().toISOString() } });
    if (!parsed.success) throw new ModelError("schema-invalid", `Idea diagnosis schema validation failed: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`, { retryable: false });
    return { diagnosis: parsed.data, promptVersion: merged.promptVersion, generationText: generation.text };
  }
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    try { return JSON.parse(candidate); } catch (error) { throw new ModelError("schema-invalid", "创意诊断返回不是合法 JSON，请重试", { retryable: false, cause: error }); }
  }
}

export function createIdeaDiagnosisService(): IdeaDiagnosisService { return new IdeaDiagnosisService(); }
