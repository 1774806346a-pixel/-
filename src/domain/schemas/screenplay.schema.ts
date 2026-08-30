import { z } from "zod";

export const SCREENPLAY_SCHEMA_VERSION = 1 as const;
export const SCREENPLAY_SCHEMA_ID = "ai-drama/screenplay/v1" as const;

const entityId = z.string().trim().min(1);
const nonEmpty = z.string().trim().min(1);

export const screenplayMetadataSchema = z
  .object({
    title: nonEmpty,
    genre: nonEmpty,
    elements: z.array(nonEmpty),
    episodeCount: z.number().int().positive(),
    episodeDurationSeconds: z.number().positive(),
    oneLineSynopsis: nonEmpty,
    comparableWorks: z.array(nonEmpty),
    audience: nonEmpty.optional(),
    format: nonEmpty.optional(),
  })
  .passthrough();

export const characterDefinitionSchema = z
  .object({
    id: entityId,
    name: nonEmpty,
    age: nonEmpty.optional(),
    identity: nonEmpty,
    appearance: nonEmpty,
    personality: nonEmpty,
    locked: z.boolean().optional(),
  })
  .passthrough();

export const sceneHeaderSchema = z
  .object({
    location: nonEmpty,
    timeOfDay: z.enum(["day", "night", "dawn", "dusk", "unspecified"]),
    setting: z.enum(["interior", "exterior", "mixed", "unspecified"]),
  })
  .passthrough();

export const actionLineSchema = z
  .object({
    id: entityId.optional(),
    type: z.literal("action"),
    subject: nonEmpty,
    description: nonEmpty,
    visualTag: z.enum(["action", "screen", "sound"]).optional(),
  })
  .passthrough();

const voiceType = z.enum(["dialogue", "VO1", "VO2", "VO3", "OS"]);
export const dialogueLineSchema = z
  .object({
    id: entityId.optional(),
    type: z.enum(["dialogue", "voice"]),
    speaker: nonEmpty,
    text: nonEmpty,
    emotion: nonEmpty.optional(),
    voiceType: voiceType.optional(),
    protected: z.boolean().optional(),
    sourceLocation: nonEmpty.optional(),
  })
  .passthrough();

export const screenplaySceneSchema = z
  .object({
    id: entityId,
    sequence: z.number().int().positive(),
    header: sceneHeaderSchema,
    heading: nonEmpty.optional(),
    characters: z.array(nonEmpty),
    actions: z.array(actionLineSchema),
    dialogues: z.array(dialogueLineSchema),
    card: z.enum(["一卡", "二卡"]).optional(),
    estimatedDurationSeconds: z.number().positive().optional(),
  })
  .passthrough()
  .superRefine((scene, ctx) => {
    if (scene.actions.length === 0 && scene.dialogues.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actions"],
        message: "场次必须至少包含动作或对白",
      });
    }
  });

export const adaptationHandlingSchema = z
  .object({
    deleted: z.array(z.string()),
    rewritten: z.array(z.string()),
    compressed: z.array(z.string()),
    foreshadowing: z.array(z.string()),
    pendingConfirmation: z.array(z.string()),
  })
  .passthrough();

export const qualitySelfCheckSchema = z
  .object({
    sceneCount: z.number().int().nonnegative(),
    actionDescriptionRate: z.number().min(0).max(1),
    dialogueEmotionRate: z.number().min(0).max(1),
    wordCount: z.number().int().nonnegative(),
    suspenseStrength: z.number().min(0).max(100),
    previousEpisodeCarryOver: z.string().optional(),
    endingHook: nonEmpty,
  })
  .passthrough();

export const screenplaySchema = z
  .object({
    id: entityId,
    projectId: entityId,
    schemaVersion: z.literal(SCREENPLAY_SCHEMA_VERSION),
    versionNumber: z.number().int().positive(),
    title: nonEmpty,
    sourceVersionId: entityId.nullable(),
    parentVersionId: entityId.nullable(),
    status: z.enum(["draft", "confirmed", "pending-confirmation", "archived"]),
    metadata: screenplayMetadataSchema,
    characters: z.array(characterDefinitionSchema),
    scenes: z.array(screenplaySceneSchema).min(1, "剧本至少需要一个场次"),
    adaptationHandling: adaptationHandlingSchema,
    qualitySelfCheck: qualitySelfCheckSchema,
    bodyMarkdown: z.string().optional(),
    createdAt: nonEmpty,
    updatedAt: nonEmpty,
  })
  .passthrough()
  .superRefine((screenplay, ctx) => {
    if (screenplay.qualitySelfCheck.sceneCount !== screenplay.scenes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qualitySelfCheck", "sceneCount"],
        message: "质量自检场次数必须与实际场次数一致",
      });
    }
    const characterIds = new Set(
      screenplay.characters.map((character) => character.id),
    );
    screenplay.scenes.forEach((scene, sceneIndex) => {
      scene.dialogues.forEach((line, lineIndex) => {
        if (!line.speaker.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "dialogues", lineIndex, "speaker"],
            message: "对白必须包含 speaker",
          });
        }
      });
      scene.characters.forEach((name, characterIndex) => {
        if (
          !characterIds.has(name) &&
          !screenplay.characters.some((character) => character.name === name)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["scenes", sceneIndex, "characters", characterIndex],
            message: "场次引用了未定义角色",
          });
        }
      });
    });
  });

export const screenplayJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SCREENPLAY_SCHEMA_ID,
  title: "AI Drama Screenplay Version",
  type: "object",
  required: [
    "id",
    "projectId",
    "schemaVersion",
    "versionNumber",
    "title",
    "metadata",
    "characters",
    "scenes",
    "adaptationHandling",
    "qualitySelfCheck",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    schemaVersion: { type: "integer", minimum: 1 },
    scenes: { type: "array", minItems: 1 },
    characters: { type: "array" },
    metadata: { type: "object" },
  },
} as const;

export type ScreenplayInput = z.input<typeof screenplaySchema>;
export type ScreenplayOutput = z.output<typeof screenplaySchema>;
