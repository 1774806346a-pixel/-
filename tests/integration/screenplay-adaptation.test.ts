import { describe, expect, it } from "vitest";
import type { GenerationEvent, GenerationRequest, ModelAdapter, ModelConnectionResult } from "../../src/application/model/model-adapter";
import { ScreenplayAdaptationService } from "../../src/application/services/screenplay-adaptation-service";
import type { ScreenplayVersion } from "../../src/domain/models";

class MockAdapter implements ModelAdapter {
  readonly provider = "ollama" as const;
  readonly modelName = "mock";
  constructor(private readonly payload: unknown) {}
  async testConnection(): Promise<ModelConnectionResult> { return { ok: true, provider: this.provider, message: "ok" }; }
  async listModels(): Promise<readonly string[]> { return [this.modelName]; }
  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> { void request; const text = JSON.stringify(this.payload); yield { type: "started", requestId: "r" }; yield { type: "validated", value: this.payload }; yield { type: "completed", text, value: this.payload }; }
}

class MarkdownAdapter extends MockAdapter {
  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> { void request; yield { type: "started", requestId: "markdown" }; yield { type: "completed", text: "## 第1集\n\n### 1-1\n△ 林安推开门\n林安（紧张）：有人吗？" }; }
}

const screenplay = (name = "林安") => ({
  title: "仓库谜案", metadata: { title: "仓库谜案", genre: "悬疑短剧", elements: ["悬疑"], episodeCount: 1, episodeDurationSeconds: 90, oneLineSynopsis: "林安打开铁盒", comparableWorks: [] },
  characters: [{ id: "c1", name, identity: "调查员", appearance: "短发", personality: "谨慎" }],
  scenes: [{ id: "s1", sequence: 1, header: { location: "仓库", timeOfDay: "night", setting: "interior" }, characters: [name], actions: [{ type: "action", subject: name, description: "打开铁盒" }], dialogues: [{ type: "dialogue", speaker: name, text: "不可能。", emotion: "震惊", protected: true }] }],
  adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] }, qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 20, suspenseStrength: 80, endingHook: "铁盒里有一张照片" },
});

const sourceVersion: ScreenplayVersion = { ...screenplay(), id: "source", projectId: "p", schemaVersion: 1, versionNumber: 1, sourceVersionId: null, parentVersionId: null, status: "confirmed", createdAt: "now", updatedAt: "now" };

describe("screenplay adaptation", () => {
  it("preserves raw Markdown when the model does not return JSON", async () => {
    const result = await new ScreenplayAdaptationService().adapt({ projectId: "p", adapter: new MarkdownAdapter({}), source: "一句话创意", entryType: "creative", episodeNumber: 1, metadata: { genre: "短剧", episodeCount: 1, episodeDurationSeconds: 90 } });
    expect(result.version.bodyMarkdown).toContain("△ 林安推开门");
    expect(result.generationText).toContain("## 第1集");
  });
  it("renders a schema-valid screenplay without changing protected dialogue", async () => {
    const result = await new ScreenplayAdaptationService().adapt({ projectId: "p", adapter: new MockAdapter(screenplay()), source: "林安（震惊）：不可能。", sourceVersion, protectedVoices: [{ id: "v1", sequence: 1, text: "不可能。", sourceLocation: { lineStart: 1, lineEnd: 1 }, type: "dialogue", allowSplit: true }], metadata: sourceVersion.metadata });
    expect(result.version.bodyMarkdown).toContain("【剧本信息】"); expect(result.version.bodyMarkdown).toContain("【第1集 质量自检】");
  });

  it("rejects an invented character when a source version is supplied", async () => {
    await expect(new ScreenplayAdaptationService().adapt({ projectId: "p", adapter: new MockAdapter(screenplay("陌生人")), source: "林安打开铁盒", sourceVersion, metadata: sourceVersion.metadata })).rejects.toThrow("prohibited inventions");
  });
});
