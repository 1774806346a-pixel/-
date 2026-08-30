import { describe, expect, it } from "vitest";
import { ProductionWorkflowService } from "../../src/application/services/production-workflow-service";
import type { ScreenplayVersion } from "../../src/domain/models";

const screenplay = (status: ScreenplayVersion["status"]): ScreenplayVersion => ({ id: "v1", projectId: "p1", schemaVersion: 1, versionNumber: 1, title: "测试", sourceVersionId: null, parentVersionId: null, status, metadata: { title: "测试", genre: "短剧", elements: [], episodeCount: 1, episodeDurationSeconds: 90, oneLineSynopsis: "概述", comparableWorks: [] }, characters: [{ id: "c1", name: "林安", identity: "记者", appearance: "短发", personality: "克制" }], scenes: [{ id: "s1", sequence: 1, header: { location: "仓库", timeOfDay: "night", setting: "interior" }, characters: ["c1"], actions: [{ type: "action", subject: "林安", description: "打开铁盒" }], dialogues: [] }], adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] }, qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 4, suspenseStrength: 5, endingHook: "照片" }, bodyMarkdown: "林安打开铁盒", createdAt: "now", updatedAt: "now" });

describe("production workflow", () => {
  it("requires confirmed versions and produces assets, boards and 10s shot groups", () => {
    const service = new ProductionWorkflowService();
    expect(() => service.extract(screenplay("draft"))).toThrow();
    const result = service.extract(screenplay("confirmed"));
    expect(result.assets.some((asset) => asset.kind === "character")).toBe(true);
    expect(result.boardPrompts.length).toBeGreaterThan(0);
    expect(result.shotGroups[0]?.durationSeconds).toBe(10);
    expect(result.shotGroups[0]?.fourGrid).toHaveLength(4);
  });
});

