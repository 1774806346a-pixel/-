import { describe, expect, it } from "vitest";
import { validateScreenplayFormat } from "../../src/domain/rules/screenplay-format-rules";
import type { ScreenplayVersion } from "../../src/domain/models";

const version = (overrides: Partial<ScreenplayVersion> = {}): ScreenplayVersion => ({
  id: "v1", projectId: "p1", schemaVersion: 1, versionNumber: 1, title: "测试", sourceVersionId: null, parentVersionId: null, status: "draft",
  metadata: { title: "测试", genre: "短剧", elements: ["悬疑"], episodeCount: 1, episodeDurationSeconds: 90, oneLineSynopsis: "一句话", comparableWorks: [] },
  characters: [{ id: "c1", name: "林安", identity: "调查员", appearance: "短发", personality: "谨慎" }],
  scenes: [{ id: "s1", sequence: 1, header: { location: "仓库", timeOfDay: "night", setting: "interior" }, characters: ["林安"], actions: [{ type: "action", subject: "林安", description: "打开铁盒" }], dialogues: [{ type: "dialogue", speaker: "林安", text: "不可能", emotion: "震惊" }] }],
  adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] }, qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 10, suspenseStrength: 80, endingHook: "铁盒打开" }, createdAt: "now", updatedAt: "now", ...overrides,
});

describe("screenplay format rules", () => {
  it("accepts production-ready scenes", () => expect(validateScreenplayFormat(version()).valid).toBe(true));
  it("requires an emotion label for every spoken line", () => expect(validateScreenplayFormat(version({ scenes: [{ ...version().scenes[0]!, dialogues: [{ type: "dialogue", speaker: "林安", text: "不可能" }] }] })).valid).toBe(false));
});
