import { describe, expect, it } from "vitest";
import { detectLockedFactChanges } from "../../src/domain/rules/locked-facts";
import type { LockedFact, ScreenplayVersion } from "../../src/domain/models";

const makeVersion = (bodyMarkdown: string): ScreenplayVersion => ({ id: bodyMarkdown, projectId: "p", schemaVersion: 1, versionNumber: 1, title: "t", sourceVersionId: null, parentVersionId: null, status: "draft", metadata: { title: "t", genre: "g", elements: [], episodeCount: 1, episodeDurationSeconds: 90, oneLineSynopsis: "s", comparableWorks: [] }, characters: [], scenes: [{ id: "s", sequence: 1, header: { location: "l", timeOfDay: "day", setting: "interior" }, characters: [], actions: [{ type: "action", subject: "x", description: "y" }], dialogues: [] }], adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] }, qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 1, suspenseStrength: 1, endingHook: "h" }, bodyMarkdown, createdAt: "n", updatedAt: "n" });

describe("locked facts", () => {
  it("reports missing locked facts as critical confirmation notices", () => {
    const facts: LockedFact[] = [{ id: "f", category: "person", value: "林安", sourceLocation: "line 2", locked: true }];
    const result = detectLockedFactChanges(makeVersion("林安出现"), makeVersion("陌生人出现"), facts);
    expect(result.valid).toBe(false); expect(result.notices[0]?.requiresConfirmation).toBe(true); expect(result.notices[0]?.severity).toBe("critical");
  });
});
