import type { ModelAdapter } from "../model/model-adapter";
import { runGeneration } from "../model/generation-runner";
import type { ScreenplayVersion, ScoreReport, ScoreDimension, ScoreTarget } from "../../domain/models";
import { scoreReportSchema } from "../../domain/schemas/score.schema";
import { buildScoreReport } from "../../domain/scoring/score-calculator";
import { SCORE_DIMENSIONS } from "../../domain/scoring/score-dimensions";

export interface CustomScoreDimension {
  readonly key: string;
  readonly label?: string;
  readonly weight?: number;
  readonly target?: string;
}

export interface ScoreScreenplayRequest {
  readonly projectId: string;
  readonly version: ScreenplayVersion;
  readonly targetProfile: string;
  readonly target?: Omit<ScoreTarget, "profile"> & { readonly profile?: string };
  readonly customDimensions?: readonly CustomScoreDimension[];
  readonly adapter: ModelAdapter;
  readonly signal?: AbortSignal;
  readonly promptVersion?: string;
}
const now = () => new Date().toISOString();
const id = () => globalThis.crypto?.randomUUID?.() ?? `score-${Date.now()}`;

export class ScreenplayScoringService {
  async score(request: ScoreScreenplayRequest): Promise<ScoreReport> {
    const customKeys = (request.customDimensions ?? []).map((item) => item.key).filter(Boolean);
    const target: ScoreTarget = {
      profile: request.target?.profile ?? request.targetProfile,
      audience: request.target?.audience,
      goals: request.target?.goals,
      constraints: request.target?.constraints,
    };
    const userPrompt = `Score this screenplay for target ${JSON.stringify(target)}. Return JSON with dimensions ${[...SCORE_DIMENSIONS.map((item) => item.key), ...customKeys].join(", ")}. Every dimension needs score 0-100, weight, reason, at least one evidence with location and exact quote, suggestion, risk and uncertainty when applicable. Also return risks, recommendations, and uncertainties arrays.\n${request.version.bodyMarkdown ?? JSON.stringify(request.version)}`;
    const result = await runGeneration(request.adapter, { taskType: "score", userPrompt, responseSchema: {}, temperature: 0.1 }, { signal: request.signal });
    let payload: Record<string, unknown>;
    try { payload = (result.value ?? JSON.parse(result.text)) as Record<string, unknown>; } catch { throw new Error("Score model output is not valid JSON"); }
    const dimensions = (Array.isArray(payload.dimensions) ? payload.dimensions : []) as ScoreDimension[];
    const configuredCustom = request.customDimensions ?? [];
    for (const definition of configuredCustom) {
      const existing = dimensions.find((item) => item.key === definition.key);
      if (existing && definition.weight !== undefined) {
        existing.weight = definition.weight;
        if (definition.label && !existing.label) existing.label = definition.label;
      } else if (!existing) {
        dimensions.push({ key: definition.key, label: definition.label, score: 0, weight: definition.weight ?? 0, reason: "模型未提供该自定义维度分析", evidence: [{ location: "unknown", quote: "未提供", rationale: "需要人工复核" }], suggestion: "补充该自定义维度分析", uncertainty: "模型未返回该维度" });
      }
    }
    const source = request.version.bodyMarkdown ?? JSON.stringify(request.version);
    for (const dimension of dimensions) {
      if (!dimension || !Array.isArray(dimension.evidence)) continue;
      for (const evidence of dimension.evidence ?? []) {
        if (!evidence || typeof evidence.location !== "string" || typeof evidence.quote !== "string") continue;
        if (evidence.location.toLowerCase() === "unknown") continue;
        if (!/^(?:line\s+\d+(?:-\d+)?|scene\b|paragraph\b|dialogue\b|character\b)/i.test(evidence.location) || !source.includes(evidence.quote)) {
          throw new Error(`Score evidence for ${dimension.key} is not traceable to the screenplay`);
        }
      }
    }
    const generationRecord = { id: `generation-${id()}`, provider: request.adapter.provider, modelName: request.adapter.modelName, promptVersion: request.promptVersion ?? "score/v1", inputVersionId: request.version.id, parameters: { temperature: 0.1 }, createdAt: now() };
    const report = buildScoreReport({
      id: id(), projectId: request.projectId, schemaVersion: 1, inputVersionId: request.version.id,
      targetProfile: request.targetProfile, target, dimensions,
      risks: Array.isArray(payload.risks) ? payload.risks.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined,
      recommendations: Array.isArray(payload.recommendations) ? payload.recommendations.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined,
      uncertainties: Array.isArray(payload.uncertainties) ? payload.uncertainties.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : undefined,
      createdAt: now(), generation: generationRecord,
    });
    const parsed = scoreReportSchema.safeParse(report);
    if (!parsed.success) throw new Error(`Score report validation failed: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    return report;
  }
}
