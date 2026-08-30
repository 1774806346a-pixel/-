import { z } from "zod";

export const SHOT_GROUP_SCHEMA_VERSION = 1 as const;
export const SHOT_GROUP_SCHEMA_ID = "ai-drama/shot-group/v1" as const;

const entityId = z.string().trim().min(1);
const nonEmpty = z.string().trim().min(1);

export const shotTimingSchema = z
  .object({ start: z.number().min(0).max(10), end: z.number().min(0).max(10) })
  .passthrough()
  .refine((timing) => timing.start < timing.end, {
    message: "镜头开始时间必须早于结束时间",
  });

export const timedShotSchema = z
  .object({
    shotId: nonEmpty,
    timing: shotTimingSchema,
    transition: nonEmpty,
    shotSize: nonEmpty,
    cameraMovement: nonEmpty,
    visualAction: nonEmpty,
    sound: nonEmpty,
    dialogueOrNarration: z.string(),
    assetRefs: z.array(nonEmpty),
  })
  .passthrough();

export const fourGridCellSchema = z
  .object({
    shotId: nonEmpty,
    sceneName: nonEmpty,
    shotSpecification: nonEmpty,
    visualDescription: nonEmpty,
    imagePrompt: nonEmpty,
    colorScript: nonEmpty,
  })
  .passthrough();

export const shotGroupSchema = z
  .object({
    id: entityId,
    projectId: entityId,
    schemaVersion: z.literal(SHOT_GROUP_SCHEMA_VERSION),
    episode: z.number().int().positive(),
    sceneId: entityId,
    durationSeconds: z.number().positive().max(10),
    characterInfo: nonEmpty,
    sceneInfo: nonEmpty,
    propUiInfo: nonEmpty,
    dialogueLock: nonEmpty,
    continuity: nonEmpty,
    styleGuide: nonEmpty,
    shots: z.array(timedShotSchema).min(3).max(4),
    fourGrid: z.array(fourGridCellSchema).length(4),
    videoPrompt: nonEmpty,
    createdAt: nonEmpty,
    updatedAt: nonEmpty,
  })
  .passthrough()
  .superRefine((group, ctx) => {
    const shotIds = group.shots.map((shot) => shot.shotId);
    if (new Set(shotIds).size !== shotIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shots"],
        message: "镜头组内 shot ID 不能重复",
      });
    }
    const idSet = new Set(shotIds);
    group.fourGrid.forEach((cell, index) => {
      if (!idSet.has(cell.shotId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fourGrid", index, "shotId"],
          message: "四宫格 shot ID 必须存在于 timed shots",
        });
      }
    });
    for (let index = 1; index < group.shots.length; index += 1) {
      const current = group.shots[index];
      const previous = group.shots[index - 1];
      if (current && previous && current.timing.start < previous.timing.start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shots", index, "timing", "start"],
          message: "timed shots 必须按开始时间排序",
        });
      }
    }
  });

export const shotGroupJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: SHOT_GROUP_SCHEMA_ID,
  title: "AI Drama Seedance2 Shot Group",
  type: "object",
  required: [
    "id",
    "projectId",
    "schemaVersion",
    "episode",
    "sceneId",
    "durationSeconds",
    "shots",
    "fourGrid",
    "videoPrompt",
  ],
  properties: {
    schemaVersion: { type: "integer", minimum: 1 },
    durationSeconds: { type: "number", exclusiveMinimum: 0, maximum: 10 },
    shots: { type: "array", minItems: 3, maxItems: 4 },
    fourGrid: { type: "array", minItems: 4, maxItems: 4 },
  },
} as const;

export type ShotGroupInput = z.input<typeof shotGroupSchema>;
export type ShotGroupOutput = z.output<typeof shotGroupSchema>;
