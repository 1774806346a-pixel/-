import type { ScoreDimension, ScoreReport } from "../models";
import { SCORE_DIMENSIONS, TARGET_PROFILES } from "./score-dimensions";

export function weightsForTarget(targetProfile: string): Record<string, number> {
  const requested = TARGET_PROFILES[targetProfile] ?? TARGET_PROFILES["竖屏短剧"]!;
  const total = Object.values(requested).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(requested).map(([key, value]) => [key, value / total]));
}

export function calculateOverallScore(dimensions: readonly Pick<ScoreDimension, "key" | "score">[], targetProfile: string): number {
  const weights = weightsForTarget(targetProfile);
  return Math.round(dimensions.reduce((sum, item) => sum + item.score * (weights[item.key] ?? 0), 0) * 100) / 100;
}

export function normalizeScoreDimensions(dimensions: readonly ScoreDimension[], targetProfile: string): ScoreDimension[] {
  const weights = weightsForTarget(targetProfile);
  const byKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]));
  const builtIns = SCORE_DIMENSIONS.map((definition) => {
    const item = byKey.get(definition.key);
    return item ? { ...item, weight: weights[definition.key] ?? definition.defaultWeight } : {
      key: definition.key, score: 0, weight: weights[definition.key] ?? definition.defaultWeight, reason: "模型未提供该维度分析", evidence: [{ location: "unknown", quote: "未提供", rationale: "需要人工复核" }], suggestion: "补充该维度分析",
    };
  });
  const custom = dimensions.filter((dimension) => !SCORE_DIMENSIONS.some((definition) => definition.key === dimension.key));
  const combined = [...builtIns, ...custom];
  const total = combined.reduce((sum, dimension) => sum + Math.max(0, dimension.weight), 0) || 1;
  return combined.map((dimension) => ({ ...dimension, weight: Math.round((Math.max(0, dimension.weight) / total) * 100000) / 100000 }));
}

export function buildScoreReport(input: Omit<ScoreReport, "overallScore" | "dimensions"> & { dimensions: readonly ScoreDimension[] }): ScoreReport {
  const dimensions = normalizeScoreDimensions(input.dimensions, input.targetProfile);
  const overallScore = Math.round(dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) * 100) / 100;
  const weights = Object.fromEntries(dimensions.map((dimension) => [dimension.key, dimension.weight]));
  return { ...input, dimensions, weights, overallScore };
}
