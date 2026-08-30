import { z } from "zod";

export const INTAKE_SCHEMA_VERSION = 1 as const;
export const INTAKE_SCHEMA_ID = "ai-drama/intake/v1" as const;

const text = z.string().trim().min(1);
const location = z.object({
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
  label: z.string().optional(),
}).passthrough();

export const intakeCharacterSchema = z.object({
  name: text,
  role: z.string().optional(),
  description: z.string().optional(),
  sourceLocation: location.optional(),
}).passthrough();

export const intakeConflictSchema = z.object({
  description: text,
  participants: z.array(text).default([]),
  sourceLocation: location.optional(),
}).passthrough();

export const intakeEventSchema = z.object({
  description: text,
  order: z.number().int().positive().optional(),
  sourceLocation: location.optional(),
}).passthrough();

export const structureNodeSchema: z.ZodType<{
  id: string; type: string; title: string; summary?: string; children?: unknown[]; sourceLocation?: unknown; needsReview?: boolean;
}> = z.lazy(() => z.object({
  id: text,
  type: text,
  title: text,
  summary: z.string().optional(),
  children: z.array(structureNodeSchema).optional(),
  sourceLocation: location.optional(),
  needsReview: z.boolean().optional(),
}).passthrough());

export const intakeDialogueSchema = z.object({
  speaker: text,
  text,
  emotion: z.string().optional(),
  sourceLocation: location.optional(),
}).passthrough();

export const intakeActionSchema = z.object({
  description: text,
  subject: z.string().optional(),
  sourceLocation: location.optional(),
}).passthrough();

export const modelMetadataSchema = z.object({
  provider: z.string().optional(),
  modelName: z.string().optional(),
  promptVersion: z.string().optional(),
  generationId: z.string().optional(),
  generatedAt: z.string().optional(),
}).passthrough();

export const intakeScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  dimensions: z.array(z.object({ key: text, label: text.optional(), score: z.number().min(0).max(100), reason: text, evidence: z.array(text).default([]) }).passthrough()).default([]),
}).passthrough();

const intakeBase = {
  schemaVersion: z.literal(INTAKE_SCHEMA_VERSION),
  inputType: z.enum(["idea", "novel", "chapter", "outline", "screenplay", "template", "free-text"]),
  summary: text,
  characters: z.array(intakeCharacterSchema),
  conflicts: z.array(intakeConflictSchema),
  events: z.array(intakeEventSchema),
  structureNodes: z.array(structureNodeSchema),
  dialogue: z.array(intakeDialogueSchema),
  actions: z.array(intakeActionSchema),
  pendingConfirmations: z.array(z.union([text, z.object({ description: text, sourceLocation: location.optional() }).passthrough()])),
  sourceLocations: z.array(location),
  modelMetadata: modelMetadataSchema,
  score: intakeScoreSchema.optional(),
  sellingPoints: z.array(text).optional(),
  risks: z.array(text).optional(),
  recommendations: z.array(text).optional(),
};

export const ideaDiagnosisSchema = z.object(intakeBase).passthrough();
export const sourceAnalysisSchema = z.object(intakeBase).passthrough();

export const ideaDiagnosisJsonSchema = { $schema: "https://json-schema.org/draft/2020-12/schema", $id: "ai-drama/idea-diagnosis/v1", type: "object", required: ["inputType", "summary", "characters", "conflicts", "events", "structureNodes", "dialogue", "actions", "pendingConfirmations", "sourceLocations", "modelMetadata"], properties: { inputType: { type: "string" }, summary: { type: "string" }, characters: { type: "array" }, conflicts: { type: "array" }, events: { type: "array" }, structureNodes: { type: "array" }, dialogue: { type: "array" }, actions: { type: "array" }, pendingConfirmations: { type: "array" }, sourceLocations: { type: "array" }, modelMetadata: { type: "object" } } } as const;
export const sourceAnalysisJsonSchema = { ...ideaDiagnosisJsonSchema, $id: "ai-drama/source-analysis/v1" } as const;

export type IdeaDiagnosis = z.output<typeof ideaDiagnosisSchema>;
export type SourceAnalysis = z.output<typeof sourceAnalysisSchema>;
