import { describe, expect, it } from "vitest";
import type { ScreenplayVersion } from "../../src/domain/models";
import { InMemoryProjectRepository } from "../../src/infrastructure/project-repository";
import { VersionService } from "../../src/application/services/version-service";
import { StoryBibleWorkflowService } from "../../src/application/services/story-bible-workflow-service";

const version = (
  overrides: Partial<ScreenplayVersion> = {},
): ScreenplayVersion => ({
  id: "v1",
  projectId: "p1",
  schemaVersion: 1,
  versionNumber: 1,
  title: "归舟",
  sourceVersionId: null,
  parentVersionId: null,
  status: "confirmed",
  metadata: {
    title: "归舟",
    genre: "悬疑",
    elements: [],
    episodeCount: 1,
    episodeDurationSeconds: 90,
    oneLineSynopsis: "林安寻找妹妹",
    comparableWorks: [],
  },
  characters: [
    {
      id: "c1",
      name: "林安",
      identity: "记者",
      appearance: "短发",
      personality: "克制",
    },
  ],
  scenes: [
    {
      id: "s1",
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
    wordCount: 5,
    suspenseStrength: 8,
    endingHook: "照片",
  },
  bodyMarkdown: "林安打开铁盒",
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
  ...overrides,
});

describe("screenplay version center workflow", () => {
  it("creates immutable child versions with parent and source lineage", async () => {
    const repository = new InMemoryProjectRepository();
    const project = await repository.createProject("版本测试");
    const service = new VersionService(repository);
    const parent = version({
      projectId: project.id,
      bodyMarkdown: "林安: 记者; 短发; 克制\n林安打开铁盒",
    });
    await repository.saveVersion(parent);
    const child = await service.createChild(parent, {
      bodyMarkdown: "林安打开铁盒\n照片上的日期是今天",
    });
    expect(child.id).not.toBe(parent.id);
    expect(child.parentVersionId).toBe(parent.id);
    expect(child.sourceVersionId).toBe(parent.id);
    expect(child.versionNumber).toBe(parent.versionNumber + 1);
    expect(
      (await repository.loadProjectGraph(project.id))?.screenplayVersions,
    ).toHaveLength(2);
  });

  it("reports line differences and blocks confirmation when a locked fact disappears", async () => {
    const repository = new InMemoryProjectRepository();
    const project = await repository.createProject("差异测试");
    const service = new VersionService(repository);
    const draftParent = version({ projectId: project.id });
    const bible = new StoryBibleWorkflowService().createFromScreenplay(
      draftParent,
    );
    const parent = {
      ...draftParent,
      bodyMarkdown: `${bible.lockedFacts[0].value}\n林安打开铁盒`,
    };
    await repository.saveVersion(parent);
    const child = await service.createChild(parent, {
      bodyMarkdown: "陌生人打开铁盒",
    });
    const diff = service.diff(parent, child, bible);
    expect(diff.entries.some((entry) => entry.type === "changed")).toBe(true);
    expect(diff.notices.length).toBeGreaterThan(0);
    await expect(service.confirm(child, diff)).rejects.toThrow();
    const confirmed = await new VersionService({
      saveVersion: async (saved) => saved,
    }).confirm(
      child,
      diff,
      diff.notices.map((notice) => notice.id),
    );
    expect(confirmed.status).toBe("confirmed");
  });

  it("restores a historical version by creating another child, preserving history", async () => {
    const repository = new InMemoryProjectRepository();
    const project = await repository.createProject("恢复测试");
    const service = new VersionService(repository);
    const parent = version({ projectId: project.id });
    await repository.saveVersion(parent);
    const child = await service.createChild(parent, {
      title: "改写稿",
      bodyMarkdown: "林安离开码头",
    });
    const restored = await service.restore(child);
    expect(restored.parentVersionId).toBe(child.id);
    expect(restored.title).toContain("恢复");
    expect(
      (await repository.loadProjectGraph(project.id))?.screenplayVersions,
    ).toHaveLength(3);
  });
});
