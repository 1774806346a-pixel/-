import { z } from "zod";

export const SCORE_SCHEMA_VERSION = 1 as const;
export const SCORE_SCHEMA_ID = "ai-drama/score-report/v1" as const;

const entityId = z.string().trim().min(1);
const nonEmpty = z.string().trim().min(1);

export const scoreDimensionKeys = [
  "hook",
  "conflict",
  "characterMotivation",
  "pacing",
  "reversal",
  "dialogue",
  "visualizability",
  "continuity",
] as const;
export type ScoreDimensionKey = (typeof scoreDimensionKeys)[number];

export const scoreEvidenceSchema = z
  .object({
    location: nonEmpty,
    quote: nonEmpty,
    rationale: nonEmpty.optional(),
  })
  .passthrough();

export const scoreDimensionSchema = z
  .object({
    key: nonEmpty,
    label: nonEmpty.optional(),
    score: z.number().min(0).max(100),
    weight: z.number().min(0).max(1),
    reason: nonEmpty,
    evidence: z.array(scoreEvidenceSchema).min(1),
    suggestion: nonEmpty,
    suggestions: z.array(nonEmpty).optional(),
    risk: nonEmpty.optional(),
    uncertainty: nonEmpty.optional(),
  })
  .passthrough();

export const scoreGenerationSchema = z
  .object({
    provider: z.enum(["ollama", "openai-compatible"]),
    modelName: nonEmpty,
    promptVersion: nonEmpty,
    parameters: z.record(
      z.string(),
      z.union([z.number(), z.string(), z.boolean()]),
    ),
    createdAt: nonEmpty,
  })
  .passthrough();

export const scoreReportSchema = z
  .object({
    id: entityId,
    projectId: entityId,
    schemaVersion: z.literal(SCORE_SCHEMA_VERSION),
    inputVersionId: entityId,
    targetProfile: nonEmpty,
    target: z.object({
      profile: nonEmpty,
      audience: nonEmpty.optional(),
      goals: z.array(nonEmpty).optional(),
      constraints: z.array(nonEmpty).optional(),
    }).passthrough().optional(),
    weights: z.record(z.string(), z.number().min(0).max(1)).optional(),
    overallScore: z.number().min(0).max(100),
    dimensions: z.array(scoreDimensionSchema).min(scoreDimensionKeys.length),
    risks: z.array(nonEmpty).optional(),
    recommendations: z.array(nonEmpty).optional(),
    uncertainties: z.array(nonEmpty).optional(),
    createdAt: nonEmpty,
    generation: scoreGenerationSchema.optional(),
  })
  .passthrough()
  .superRefine((report, ctx) => {
    const keys = report.dimensions.map((dimension) => dimension.key);
    const uniqueKeys = new Set(keys);
    if (
      uniqueKeys.size !== keys.length ||
      scoreDimensionKeys.some((key) => !uniqueKeys.has(key))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimensions"],
        message: "评分报告必须完整包含八个评分维度且不能重复",
      });
    }
    const weightTotal = report.dimensions.reduce(
      (total, dimension) => total + dimension.weight,
      0,
    );
    if (Math.abs(weightTotal - 1) > 0.001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dimensions"],
        message: "评分权重总和必须为 1",
      });
    }
  });

export const scoreReportJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SCORE_SCHEMA_ID,
  title: "AI Drama Score Report",
  type: "object",
  required: [
    "id",
    "projectId",
    "schemaVersion",
    "inputVersionId",
    "targetProfile",
    "overallScore",
    "dimensions",
    "createdAt",
  ],
  properties: {
    schemaVersion: { type: "integer", minimum: 1 },
    overallScore: { type: "number", minimum: 0, maximum: 100 },
    // Eight built-ins are required by validation; custom dimensions may follow.
    dimensions: { type: "array", minItems: 8 },
    target: { type: "object" },
    weights: { type: "object", additionalProperties: { type: "number", minimum: 0, maximum: 1 } },
    risks: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    uncertainties: { type: "array", items: { type: "string" } },
  },
} as const;

export type ScoreReportInput = z.input<typeof scoreReportSchema>;
export type ScoreReportOutput = z.output<typeof scoreReportSchema>;
