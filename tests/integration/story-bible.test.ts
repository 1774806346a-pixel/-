import { describe, expect, it } from "vitest";
import type { ScreenplayVersion } from "../../src/domain/models";
import { StoryBibleWorkflowService } from "../../src/application/services/story-bible-workflow-service";

function screenplay(
  status: ScreenplayVersion["status"] = "confirmed",
): ScreenplayVersion {
  return {
    id: "screenplay-v1",
    projectId: "project-1",
    schemaVersion: 1,
    versionNumber: 1,
    title: "归舟",
    sourceVersionId: null,
    parentVersionId: null,
    status,
    metadata: {
      title: "归舟",
      genre: "悬疑",
      elements: ["密室"],
      episodeCount: 1,
      episodeDurationSeconds: 90,
      oneLineSynopsis: "林安在雨夜寻找失踪的妹妹",
      comparableWorks: [],
    },
    characters: [
      {
        id: "char-linan",
        name: "林安",
        identity: "记者",
        appearance: "短发",
        personality: "克制",
      },
    ],
    scenes: [
      {
        id: "scene-1",
        sequence: 1,
        header: { location: "旧码头", timeOfDay: "night", setting: "exterior" },
        characters: ["林安"],
        actions: [{ type: "action", subject: "林安", description: "打开铁盒" }],
        dialogues: [],
      },
    ],
    adaptationHandling: {
      deleted: [],
      rewritten: [],
      compressed: [],
      foreshadowing: [],
      pendingConfirmation: [],
    },
    qualitySelfCheck: {
      sceneCount: 1,
      actionDescriptionRate: 1,
      dialogueEmotionRate: 1,
      wordCount: 8,
      suspenseStrength: 8,
      endingHook: "铁盒里有一张照片",
    },
    bodyMarkdown: "# 归舟\n林安在雨夜寻找失踪的妹妹",
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
  };
}

describe("story bible workflow", () => {
  it("extracts a structured bible with locked character, timeline, and plot facts", () => {
    const bible = new StoryBibleWorkflowService().createFromScreenplay(
      screenplay(),
    );
    expect(bible.projectId).toBe("project-1");
    expect(bible.characters[0]).toMatchObject({
      id: "char-linan",
      name: "林安",
      locked: true,
    });
    expect(bible.timeline).toEqual(["1. 旧码头 / night"]);
    expect(bible.lockedFacts.map((fact) => fact.category)).toEqual([
      "person",
      "timeline",
      "plot",
    ]);
    expect(bible.lockedFacts.every((fact) => fact.locked)).toBe(true);
  });

  it("rejects extraction from an unconfirmed screenplay", () => {
    expect(() =>
      new StoryBibleWorkflowService().createFromScreenplay(screenplay("draft")),
    ).toThrow();
  });

  it("requires explicit confirmation before a locked fact can change or be removed", () => {
    const service = new StoryBibleWorkflowService();
    const bible = service.createFromScreenplay(screenplay());
    const fact = bible.lockedFacts[0];
    const changed = {
      lockedFacts: bible.lockedFacts.map((item) =>
        item.id === fact.id ? { ...item, value: "林安：失业记者" } : item,
      ),
    };
    const preview = service.update(bible, changed);
    expect(preview.notices.some((notice) => notice.factId === fact.id)).toBe(
      true,
    );
    expect(
      preview.bible.lockedFacts.find((item) => item.id === fact.id)?.value,
    ).toBe(fact.value);
    const notices = bible.lockedFacts.map((item) => item.id);
    const updated = service.update(bible, changed, notices);
    expect(updated.notices.some((notice) => notice.factId === fact.id)).toBe(
      true,
    );
    expect(() => service.removeFact(updated.bible, fact.id)).toThrow(
      /confirmation/i,
    );
    expect(
      service.removeFact(updated.bible, fact.id, [fact.id]).lockedFacts,
    ).toHaveLength(bible.lockedFacts.length - 1);
  });

  it("supports lock and unlock without mutating the prior bible snapshot", () => {
    const service = new StoryBibleWorkflowService();
    const bible = service.createFromScreenplay(screenplay());
    const fact = bible.lockedFacts[0];
    const unlocked = service.unlockFact(bible, fact.id);
    expect(
      unlocked.lockedFacts.find((item) => item.id === fact.id)?.locked,
    ).toBe(false);
    expect(bible.lockedFacts.find((item) => item.id === fact.id)?.locked).toBe(
      true,
    );
    expect(
      service
        .lockFact(unlocked, fact.id)
        .lockedFacts.find((item) => item.id === fact.id)?.locked,
    ).toBe(true);
  });
});
