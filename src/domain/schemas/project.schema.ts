import { z } from "zod";

export const PROJECT_SCHEMA_VERSION = 1 as const;
export const PROJECT_SCHEMA_ID = "ai-drama/project/v1" as const;

const entityId = z.string().trim().min(1);
const timestamp = z.string().trim().min(1);

export const projectSchema = z
  .object({
    id: entityId,
    name: z.string().trim().min(1),
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    createdAt: timestamp,
    updatedAt: timestamp,
    sourceDocumentIds: z.array(entityId),
    activeVersionId: entityId.nullable(),
    storyBibleId: entityId.nullable(),
    deletedAt: timestamp.nullable().optional(),
  })
  .passthrough();

export const sourceDocumentSchema = z
  .object({
    id: entityId,
    projectId: entityId,
    schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    kind: z.enum([
      "idea",
      "novel",
      "chapter",
      "outline",
      "screenplay",
      "template",
    ]),
    title: z.string().trim().min(1),
    body: z.string(),
    sha256: z.string().trim().min(1),
    wordCount: z.number().int().nonnegative(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .passthrough();

/** JSON Schema metadata is exported alongside Zod for persistence/export registries. */
export const projectJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: PROJECT_SCHEMA_ID,
  title: "AI Drama Project",
  type: "object",
  required: [
    "id",
    "name",
    "schemaVersion",
    "createdAt",
    "updatedAt",
    "sourceDocumentIds",
    "activeVersionId",
    "storyBibleId",
  ],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    schemaVersion: { type: "integer", minimum: 1 },
    createdAt: { type: "string", minLength: 1 },
    updatedAt: { type: "string", minLength: 1 },
    sourceDocumentIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    activeVersionId: { type: ["string", "null"] },
    storyBibleId: { type: ["string", "null"] },
  },
} as const;

export type ProjectInput = z.input<typeof projectSchema>;
export type ProjectOutput = z.output<typeof projectSchema>;
