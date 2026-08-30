import { describe, expect, it } from "vitest";
import type { ScreenplayVersion } from "../../src/domain/models";
import { RewriteWorkflowService, type RewriteWorkflowResult } from "../../src/application/services/rewrite-workflow-service";

const version = (id: string): ScreenplayVersion => ({
  id, projectId: "p", schemaVersion: 1, versionNumber: 1, title: "测试", sourceVersionId: null, parentVersionId: null, status: "draft",
  metadata: { title: "测试", genre: "短剧", elements: [], episodeCount: 1, episodeDurationSeconds: 90, oneLineSynopsis: "概述", comparableWorks: [] }, characters: [],
  scenes: [{ id: `${id}-scene`, sequence: 1, header: { location: "室内", timeOfDay: "day", setting: "interior" }, characters: [], actions: [{ type: "action", subject: "人物", description: "行动" }], dialogues: [] }],
  adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] }, qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 1, suspenseStrength: 1, endingHook: "结尾" }, bodyMarkdown: "原文", createdAt: "now", updatedAt: "now",
});

describe("score and rewrite workflow", () => {
  it("keeps rewrite candidates linked to the source and requires confirmation", async () => {
    const saved: ScreenplayVersion[] = [];
    const candidate = version("v2");
    const notice = { id: "fact-1", category: "plot" as const, before: "a", after: "b", location: "x", severity: "critical" as const, requiresConfirmation: true, confirmed: false };
    const fakeRewrite = { rewrite: async () => ({ version: { ...candidate, status: "pending-confirmation" as const, parentVersionId: "v1" }, diff: { fromVersionId: "v1", toVersionId: "v2", entries: [], notices: [notice] }, notices: [notice], promptVersion: "rewrite/v1" }) };
    const service = new RewriteWorkflowService({ saveVersion: async (v) => { saved.push(v); return v; } }, fakeRewrite as never);
    const result = await service.generate({ adapter: { provider: "ollama", modelName: "mock", testConnection: async () => ({ ok: true, provider: "ollama", message: "ok" }), listModels: async () => [], generate: async function* () {} }, projectId: "p", sourceVersion: version("v1"), scope: { kind: "scene", sceneId: "v1-scene" }, userPrompt: "强化冲突" });
    await expect(service.confirm(result)).rejects.toThrow();
    await service.confirm(result, ["fact-1"]);
    expect(saved[0]?.status).toBe("confirmed");
    expect(result.record.sourceVersionId).toBe("v1");
  });
});
