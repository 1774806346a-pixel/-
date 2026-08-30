import { describe, expect, it } from "vitest";
import { mergePromptLayers } from "../../src/application/prompts/prompt-layers";
import { createScreenplayPromptLayers } from "../../src/application/prompts/screenplay-prompts";

describe("prompt layers", () => {
  it("keeps policy before user direction and schema last", () => {
    const merged = mergePromptLayers({
      internalPolicy: {
        name: "internal-policy",
        promptVersion: "1",
        content: "policy",
      },
      storyBible: { name: "story-bible", promptVersion: "1", content: "bible" },
      task: { name: "task", promptVersion: "1", content: "task" },
      user: { name: "user", promptVersion: "1", content: "user" },
      schema: { name: "schema", promptVersion: "1", content: "schema" },
    });
    expect(merged.systemPrompt).toContain("policy");
    expect(merged.userPrompt.indexOf("user")).toBeLessThan(
      merged.userPrompt.indexOf("schema"),
    );
  });

  it("includes the short-drama template and episodic references in the task prompt", () => {
    const layers = createScreenplayPromptLayers({
      source: "A one-line idea",
      metadata: {
        genre: "mystery",
        episodeCount: 8,
        episodeDurationSeconds: 90,
        audience: "general",
      },
      entryType: "creative",
      outline: "The protagonist must expose the hidden witness.",
      episodeNumber: 2,
      previousEpisodes: [
        { episodeNumber: 1, screenplay: "Episode one screenplay" },
      ],
      formatTemplate: "【本次改编】\n【剧本信息】\n## 第X集",
    });
    expect(layers.task.content).toContain("【本次改编】");
    expect(layers.task.content).toContain(
      "The protagonist must expose the hidden witness.",
    );
    expect(layers.task.content).toContain("episode 2");
    expect(layers.task.content).toContain("90s");
    expect(layers.task.content).toContain("Episode one screenplay");
    expect(layers.internalPolicy.content).toContain("creative entry");
    expect(layers.internalPolicy.content).not.toContain(
      "absent from the source",
    );
  });

  it("keeps source-entry no-invention policy strict", () => {
    const layers = createScreenplayPromptLayers({
      source: "A novel chapter",
      metadata: {
        genre: "mystery",
        episodeCount: 1,
        episodeDurationSeconds: 90,
        audience: "general",
      },
      entryType: "source",
    });
    expect(layers.internalPolicy.content).toContain(
      "absent from the source or locked facts",
    );
  });
});
