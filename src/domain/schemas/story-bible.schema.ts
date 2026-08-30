import { z } from "zod";

export const STORY_BIBLE_SCHEMA_VERSION = 1 as const;
export const STORY_BIBLE_SCHEMA_ID = "ai-drama/story-bible/v1" as const;

const text = z.string().trim().min(1);
const entityId = text;

export const lockedFactCategorySchema = z.enum([
  "person",
  "relationship",
  "world",
  "timeline",
  "plot",
]);

export const lockedFactSchema = z
  .object({
    id: entityId,
    category: lockedFactCategorySchema,
    value: text,
    sourceLocation: text,
    locked: z.boolean(),
  })
  .passthrough();

export const storyBibleCharacterSchema = z
  .object({
    id: entityId,
    name: text,
    age: text.optional(),
    identity: text,
    appearance: text,
    personality: text,
    locked: z.boolean().optional(),
  })
  .passthrough();

/** Structured, project-level facts consumed by screenplay and production prompts. */
export const storyBibleSchema = z
  .object({
    id: entityId,
    projectId: entityId,
    schemaVersion: z.literal(STORY_BIBLE_SCHEMA_VERSION),
    characters: z.array(storyBibleCharacterSchema),
    assets: z.array(entityId),
    lockedFacts: z.array(lockedFactSchema),
    timeline: z.array(text),
    // These fields are optional for backwards compatibility with the original domain model.
    relationships: z.array(text).optional(),
    worldRules: z.array(text).optional(),
    scenes: z.array(text).optional(),
    props: z.array(text).optional(),
    uiElements: z.array(text).optional(),
    pendingConfirmations: z.array(text).optional(),
    createdAt: text,
    updatedAt: text,
  })
  .passthrough()
  .superRefine((bible, ctx) => {
    const ids = new Set<string>();
    bible.lockedFacts.forEach((fact, index) => {
      if (ids.has(fact.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lockedFacts", index, "id"], message: "Locked fact IDs must be unique" });
      }
      ids.add(fact.id);
    });
    bible.assets.forEach((asset, index) => {
      if (!asset.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["assets", index], message: "Asset IDs cannot be empty" });
    });
  });

export const storyBibleJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: STORY_BIBLE_SCHEMA_ID,
  title: "AI Drama Story Bible",
  type: "object",
  required: ["id", "projectId", "schemaVersion", "characters", "assets", "lockedFacts", "timeline", "createdAt", "updatedAt"],
  properties: {
    schemaVersion: { const: STORY_BIBLE_SCHEMA_VERSION },
    characters: { type: "array" },
    assets: { type: "array", items: { type: "string" } },
    lockedFacts: { type: "array" },
    timeline: { type: "array", items: { type: "string" } },
  },
} as const;

export type StoryBibleInput = z.input<typeof storyBibleSchema>;
export type StoryBibleOutput = z.output<typeof storyBibleSchema>;
