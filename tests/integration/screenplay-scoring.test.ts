import { describe, expect, it } from "vitest";
import type { GenerationEvent, GenerationRequest, ModelAdapter, ModelConnectionResult } from "../../src/application/model/model-adapter";
import { ScreenplayScoringService } from "../../src/application/services/screenplay-scoring-service";
import { SCORE_DIMENSIONS } from "../../src/domain/scoring/score-dimensions";
import type { ScreenplayVersion } from "../../src/domain/models";

class MockAdapter implements ModelAdapter {
  readonly provider = "ollama" as const; readonly modelName = "mock";
  async testConnection(): Promise<ModelConnectionResult> { return { ok: true, provider: this.provider, message: "ok" }; }
  async listModels(): Promise<readonly string[]> { return [this.modelName]; }
  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> { void request; const value = { dimensions: SCORE_DIMENSIONS.map(({ key }) => ({ key, score: 80, weight: 0, reason: "有明确动作", evidence: [{ location: "line 2", quote: "林安打开铁盒" }], suggestion: "加强反转" })) }; const text = JSON.stringify(value); yield { type: "started", requestId: "r" }; yield { type: "completed", text, value }; }
}

const version: ScreenplayVersion = { id: "v", projectId: "p", schemaVersion: 1, versionNumber: 1, title: "t", sourceVersionId: null, parentVersionId: null, status: "draft", metadata: { title: "t", genre: "悬疑", elements: [], episodeCount: 1, episodeDurationSeconds: 90, oneLineSynopsis: "s", comparableWorks: [] }, characters: [], scenes: [{ id: "s", sequence: 1, header: { location: "仓库", timeOfDay: "night", setting: "interior" }, characters: [], actions: [{ type: "action", subject: "林安", description: "打开铁盒" }], dialogues: [] }], adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] }, qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 1, suspenseStrength: 1, endingHook: "h" }, bodyMarkdown: "# 标题\n林安打开铁盒", createdAt: "now", updatedAt: "now" };

describe("screenplay scoring", () => {
  it("returns all dimensions, normalized weights, and traceable citations", async () => {
    const report = await new ScreenplayScoringService().score({ projectId: "p", version, targetProfile: "AI漫剧", adapter: new MockAdapter() });
    expect(report.dimensions).toHaveLength(8); expect(report.dimensions.reduce((total, item) => total + item.weight, 0)).toBeCloseTo(1); expect(report.dimensions[0]?.evidence[0]?.location).toBe("line 2");
  });
});
