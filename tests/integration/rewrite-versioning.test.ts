import { describe, expect, it } from "vitest";
import { diffScreenplayVersions, canPromoteVersion } from "../../src/domain/versioning/version-diff";
import { confirmChange } from "../../src/domain/rules/locked-facts";
import type { ScreenplayVersion } from "../../src/domain/models";

const v = (id: string, bodyMarkdown: string): ScreenplayVersion => ({ id, projectId: "p", schemaVersion: 1, versionNumber: 1, title: "t", sourceVersionId: null, parentVersionId: null, status: "draft", metadata: { title: "t", genre: "g", elements: [], episodeCount: 1, episodeDurationSeconds: 90, oneLineSynopsis: "s", comparableWorks: [] }, characters: [], scenes: [{ id: "s", sequence: 1, header: { location: "l", timeOfDay: "day", setting: "interior" }, characters: [], actions: [{ type: "action", subject: "x", description: "y" }], dialogues: [] }], adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] }, qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 1, suspenseStrength: 1, endingHook: "h" }, bodyMarkdown, createdAt: "n", updatedAt: "n" });

describe("rewrite versioning", () => {
  it("keeps historical diff and gates promotion on confirmation", () => {
    const diff = diffScreenplayVersions(v("a", "林安\n钩子"), v("b", "陌生人\n钩子"), [{ id: "f", category: "person", value: "林安", sourceLocation: "line 1", locked: true }]);
    expect(diff.entries.some((entry) => entry.type === "changed")).toBe(true); expect(canPromoteVersion(diff)).toBe(false);
    expect(canPromoteVersion({ ...diff, notices: diff.notices.map(confirmChange) })).toBe(true);
  });
});
