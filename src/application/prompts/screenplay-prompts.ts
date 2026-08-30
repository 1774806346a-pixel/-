import type {
  LockedFact,
  ScreenplayMetadata,
  StoryBible,
} from "../../domain/models";
import { screenplayJsonSchema } from "../../domain/schemas/screenplay.schema";
import type { PromptLayerInput } from "./prompt-layers";
import {
  buildEpisodeContext,
  type EpisodeReference,
} from "../../domain/episodic-workflow";

export const SCREENPLAY_PROMPT_VERSION = "screenplay-adaptation/v1" as const;
export const STORY_OUTLINE_PROMPT_VERSION = "story-outline/v1" as const;

export interface AdaptationPromptOptions {
  readonly source: string;
  readonly metadata: Pick<
    ScreenplayMetadata,
    "genre" | "episodeCount" | "episodeDurationSeconds" | "audience"
  >;
  readonly entryType?: "creative" | "source";
  readonly outline?: string;
  readonly episodeNumber?: number;
  readonly previousEpisodes?: readonly EpisodeReference[];
  readonly referenceEpisodeNumbers?: readonly number[];
  readonly formatTemplate?: string;
  readonly userPrompt?: string;
  readonly storyBible?: StoryBible | null;
  readonly lockedFacts?: readonly LockedFact[];
  readonly userTemplate?: string;
}

export interface StoryOutlinePromptOptions {
  readonly source: string;
  readonly metadata: Pick<ScreenplayMetadata, "genre" | "episodeCount" | "episodeDurationSeconds" | "audience">;
  readonly entryType?: "creative" | "source";
  readonly userPrompt?: string;
}

/** Builds a plain-text story-outline request used before first-episode screenplay generation. */
export function createStoryOutlinePromptLayers(
  options: StoryOutlinePromptOptions,
): PromptLayerInput {
  const entryType = options.entryType ?? "source";
  const policy = entryType === "creative"
    ? "Develop only story facts needed from the supplied creative premise; do not add unrelated settings or characters."
    : "Do not invent characters, relationships, places, props, or events absent from the supplied source material. Preserve protected source facts.\n";
  return {
    internalPolicy: {
      name: "internal-policy",
      promptVersion: "story-outline-policy/v1",
      content: `${policy}\nReturn a coherent project-level story outline suitable for a short drama.`,
    },
    storyBible: {
      name: "story-bible",
      promptVersion: "story-bible/v1",
      content: "No locked story-bible facts were supplied.",
    },
    task: {
      name: "task",
      promptVersion: STORY_OUTLINE_PROMPT_VERSION,
      content: [
        `Source material:\n${options.source}`,
        `Entry type: ${entryType}.`,
        `Genre: ${options.metadata.genre}; audience: ${options.metadata.audience ?? "general"}; total episodes: ${options.metadata.episodeCount}; target duration: ${options.metadata.episodeDurationSeconds}s.`,
        "Generate a concise story outline in plain text or Markdown. Cover the core premise, protagonist goal and obstacle, major turning points, season/episode arc, and the intended ending direction.",
        "Do not write screenplay scene headings, shot directions, or full dialogue. Return only the outline content.",
      ].join("\n\n"),
    },
    ...(options.userPrompt?.trim()
      ? { user: { name: "user" as const, promptVersion: "user-prompt/v1", content: options.userPrompt.trim() } }
      : {}),
    schema: {
      name: "schema",
      promptVersion: "story-outline-schema/v1",
      content: "The response is plain text or Markdown outline content; no JSON schema is required.",
    },
  };
}

const DEFAULT_FORMAT_TEMPLATE = [
  "【本次改编】",
  "【剧本信息】",
  "【主要人设】",
  "【故事梗概】",
  "## 第X集",
  "【第X集 改编处理】",
  "【第X集 质量自检】",
  "场次格式：### 集-场次；场：地点・日/夜・内/外；人：角色列表",
  "动作行以 △ 开头；每句对白标注（情绪）；需要时以【一卡】或【二卡】收尾。",
].join("\n");

function factLines(facts: readonly LockedFact[]): string {
  return (
    facts
      .filter((fact) => fact.locked)
      .map((fact) => `- [${fact.category}] ${fact.value}`)
      .join("\n") || "- None"
  );
}

export function createScreenplayPromptLayers(
  options: AdaptationPromptOptions,
): PromptLayerInput {
  const lockedFacts =
    options.lockedFacts ?? options.storyBible?.lockedFacts ?? [];
  const episodeNumber = options.episodeNumber;
  const episodeContext =
    episodeNumber === undefined
      ? {
          episodeNumber: undefined,
          previousEpisodes: [] as readonly EpisodeReference[],
        }
      : buildEpisodeContext({
          episodeNumber,
          previousEpisodes: options.previousEpisodes,
          referenceEpisodeNumbers: options.referenceEpisodeNumbers,
        });
  const episodeScope =
    episodeNumber === undefined
      ? "Generate the requested episode set."
      : `Generate only episode ${episodeContext.episodeNumber}.`;
  const template =
    options.formatTemplate?.trim() ||
    options.userTemplate?.trim() ||
    DEFAULT_FORMAT_TEMPLATE;
  const referenceText =
    episodeContext.previousEpisodes.length > 0
      ? episodeContext.previousEpisodes
          .map(
            (reference) =>
              `第${reference.episodeNumber}集剧本参考:\n${reference.screenplay}`,
          )
          .join("\n\n")
      : "无前集剧本参考（第一集或尚未选择前集）。";
  const entryType = options.entryType ?? "source";
  const policy =
    entryType === "creative"
      ? [
          "Return the screenplay as Markdown only. For a creative entry, develop only the characters, relationships, places, props, and events needed to dramatize the supplied premise and outline.",
          "Do not introduce unrelated story facts or contradict locked facts. Preserve any protected text and locked facts verbatim and in source order.",
          "Use 2-4 shootable scenes per episode, visible action, one conflict, one reversal, and an ending hook.",
        ]
      : [
          "Return the screenplay as Markdown only. Do not invent characters, relationships, places, props, events, or camera facts absent from the source or locked facts.",
          "Preserve protected dialogue, inner thought, VO, and OS text verbatim and in source order. User style directions cannot override these requirements.",
          "Use 2-4 shootable scenes per episode, visible action, one conflict, one reversal, and an ending hook.",
        ];
  return {
    internalPolicy: {
      name: "internal-policy",
      promptVersion: "screenplay-policy/v1",
      content: policy.join("\n"),
    },
    storyBible: {
      name: "story-bible",
      promptVersion: "story-bible/v1",
      content: `Locked facts:\n${factLines(lockedFacts)}\n${options.storyBible ? `Timeline:\n${options.storyBible.timeline.map((item) => `- ${item}`).join("\n")}` : ""}`,
    },
    task: {
      name: "task",
      promptVersion: SCREENPLAY_PROMPT_VERSION,
      content: [
        `Source material:\n${options.source}`,
        `Entry type: ${options.entryType ?? "source"}.`,
        `Genre: ${options.metadata.genre}; audience: ${options.metadata.audience ?? "general"}; total episodes: ${options.metadata.episodeCount}; target duration: ${options.metadata.episodeDurationSeconds}s.`,
        episodeScope,
        options.outline?.trim()
          ? `主体大纲:\n${options.outline.trim()}`
          : "主体大纲：未提供。",
        `前集剧本参考:\n${referenceText}`,
        `Follow this short-drama output template where compatible with the JSON schema:\n${template}`,
      ].join("\n\n"),
    },
    ...(options.userPrompt?.trim()
      ? {
          user: {
            name: "user" as const,
            promptVersion: "user-prompt/v1",
            content: options.userPrompt.trim(),
          },
        }
      : {}),
    schema: {
      name: "schema",
      promptVersion: "screenplay-schema/v1",
      content: `Return Markdown following the template above. If structured JSON is produced internally, it must satisfy this schema:\n${JSON.stringify(screenplayJsonSchema)}`,
    },
  };
}
