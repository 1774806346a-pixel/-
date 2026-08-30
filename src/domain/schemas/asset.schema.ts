import { z } from "zod";

export const ASSET_SCHEMA_VERSION = 1 as const;
export const ASSET_SCHEMA_ID = "ai-drama/asset/v1" as const;
export const BOARD_PROMPT_SCHEMA_VERSION = 1 as const;

const entityId = z.string().trim().min(1);
const nonEmpty = z.string().trim().min(1);
const assetKinds = ["character", "scene", "prop", "ui"] as const;

export const assetKindSchema = z.enum(assetKinds);
export const assetAppearanceSchema = z
  .object({
    episode: z.number().int().positive(),
    scene: nonEmpty,
    shot: nonEmpty.optional(),
  })
  .passthrough();

const assetName = z
  .string()
  .trim()
  .min(2)
  .regex(/^@[^@\s]+$/, "资产名称必须以 @ 开头且不能包含空格");
const assetPrefix: Record<(typeof assetKinds)[number], string> = {
  character: "@人物",
  scene: "@场景",
  prop: "@道具",
  ui: "@UI",
};

export const assetSchema = z
  .object({
    id: entityId,
    projectId: entityId,
    schemaVersion: z.literal(ASSET_SCHEMA_VERSION),
    kind: assetKindSchema,
    name: assetName,
    displayName: nonEmpty,
    description: nonEmpty,
    firstAppearance: assetAppearanceSchema,
    appearances: z.array(assetAppearanceSchema),
    aliases: z.array(nonEmpty),
    locked: z.boolean(),
    deletedAt: nonEmpty.nullable().optional(),
  })
  .passthrough()
  .superRefine((asset, ctx) => {
    if (!asset.name.startsWith(assetPrefix[asset.kind])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: `${asset.kind} 资产名称必须以 ${assetPrefix[asset.kind]} 开头`,
      });
    }
  });

export const boardPromptReferenceSchema = z
  .object({
    absolutePath: nonEmpty,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    sha256: nonEmpty,
  })
  .passthrough();

export const boardPromptSchema = z
  .object({
    id: entityId,
    assetId: entityId,
    schemaVersion: z.literal(BOARD_PROMPT_SCHEMA_VERSION),
    purpose: nonEmpty,
    styleBaseline: nonEmpty,
    decomposition: nonEmpty,
    colorConstraints: nonEmpty.optional(),
    layoutRequirements: nonEmpty,
    prompt: nonEmpty,
    avoid: nonEmpty,
    reference: boardPromptReferenceSchema.optional(),
  })
  .passthrough();

export const assetJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: ASSET_SCHEMA_ID,
  title: "AI Drama Asset",
  type: "object",
  required: [
    "id",
    "projectId",
    "schemaVersion",
    "kind",
    "name",
    "displayName",
    "description",
    "firstAppearance",
    "appearances",
    "aliases",
    "locked",
  ],
  properties: {
    schemaVersion: { type: "integer", minimum: 1 },
    kind: { enum: [...assetKinds] },
    name: { type: "string", pattern: "^@[^@\\s]+$" },
  },
} as const;

export type AssetInput = z.input<typeof assetSchema>;
export type AssetOutput = z.output<typeof assetSchema>;
