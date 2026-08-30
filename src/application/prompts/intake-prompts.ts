import { ideaDiagnosisJsonSchema, sourceAnalysisJsonSchema } from "../../domain/schemas/intake.schema";
import type { PromptLayerInput } from "./prompt-layers";

export const INTAKE_PROMPT_VERSION = "intake/v1" as const;

export function createIdeaDiagnosisPromptLayers(input: string): PromptLayerInput {
  return createLayers("idea", input, ideaDiagnosisJsonSchema, "Diagnose and score the idea. Return an overall score from 0-100 plus dimension scores for hook, conflict, character motivation, visualizability, pacing, and audience fit. Include concise production-usable structure, selling points, risks, recommendations, and questions.");
}

export function createSourceAnalysisPromptLayers(input: string, inputType: "novel" | "chapter" | "outline" | "free-text" = "free-text"): PromptLayerInput {
  return createLayers(inputType, input, sourceAnalysisJsonSchema, "Extract and score a faithful source analysis. Return an overall score from 0-100 plus dimension scores for hook, conflict, character motivation, visualizability, pacing, and adaptation readiness. Preserve locations where possible and mark uncertain or unknown structure nodes for review; include selling points, risks, and recommendations.");
}

function createLayers(inputType: string, input: string, schema: unknown, task: string): PromptLayerInput {
  return {
    internalPolicy: { name: "internal-policy", promptVersion: "intake-policy/v1", content: "Return JSON only. Do not invent facts. Every uncertain inference belongs in pendingConfirmations." },
    storyBible: { name: "story-bible", promptVersion: "story-bible/v1", content: "No locked story bible is available for intake." },
    task: { name: "task", promptVersion: INTAKE_PROMPT_VERSION, content: `${task}\nInput type: ${inputType}\nSource:\n${input}` },
    schema: { name: "schema", promptVersion: "intake-schema/v1", content: `Validate against this JSON schema before returning:\n${JSON.stringify(schema)}` },
  };
}
