import { describe, expect, it } from "vitest";
import type { GenerationEvent, GenerationRequest, ModelAdapter, ModelConnectionResult } from "../../src/application/model/model-adapter";
import { ProjectService } from "../../src/application/services/project-service";
import { ScreenplayAdaptationService } from "../../src/application/services/screenplay-adaptation-service";
import { InMemoryProjectRepository } from "../../src/infrastructure/project-repository";
import { generateEpisodeWithOutline } from "../../src/features/episodic/EpisodicWorkspace";

const payload = (title: string) => ({
  title,
  metadata: { title, genre: "mystery", elements: [], episodeCount: 3, episodeDurationSeconds: 90, oneLineSynopsis: "A clue appears", comparableWorks: [] },
  characters: [{ id: "c1", name: "Lin", identity: "reporter", appearance: "short hair", personality: "calm" }],
  scenes: [{ id: "s1", sequence: 1, header: { location: "warehouse", timeOfDay: "night", setting: "interior" }, characters: ["Lin"], actions: [{ type: "action", subject: "Lin", description: "opens box" }], dialogues: [{ type: "dialogue", speaker: "Lin", text: "Impossible.", emotion: "shocked" }] }],
  adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] },
  qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 1, wordCount: 5, suspenseStrength: 80, endingHook: "a photo" },
});

class CapturingAdapter implements ModelAdapter {
  readonly provider = "ollama" as const;
  readonly modelName = "mock";
  readonly requests: GenerationRequest[] = [];
  constructor(private readonly result: unknown, private readonly fail = false) {}
  async testConnection(): Promise<ModelConnectionResult> { return { ok: true, provider: this.provider, message: "ok" }; }
  async listModels(): Promise<readonly string[]> { return [this.modelName]; }
  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    this.requests.push(request);
    if (this.fail) throw new Error("generation failed");
    yield { type: "started", requestId: "r" };
    yield { type: "completed", text: JSON.stringify(this.result), value: this.result };
  }
}

class OutlineThenScreenplayAdapter implements ModelAdapter {
  readonly provider = "ollama" as const;
  readonly modelName = "mock";
  readonly requests: GenerationRequest[] = [];
  async testConnection(): Promise<ModelConnectionResult> { return { ok: true, provider: this.provider, message: "ok" }; }
  async listModels(): Promise<readonly string[]> { return [this.modelName]; }
  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    this.requests.push(request);
    if (request.taskType === "custom") {
      yield { type: "completed", text: "Protagonist uncovers a hidden witness; the first episode ends on a reveal." };
      return;
    }
    const value = payload("screenplay");
    yield { type: "completed", text: JSON.stringify(value), value };
  }
}

describe("episodic screenplay generation", () => {
  it("generates and persists an outline before the first episode screenplay", async () => {
    const repository = new InMemoryProjectRepository();
    const project = await repository.createProject("demo");
    const service = new ProjectService(repository, new ScreenplayAdaptationService());
    const adapter = new OutlineThenScreenplayAdapter();

    const result = await generateEpisodeWithOutline({
      projectService: service,
      request: { projectId: project.id, adapter, entryType: "creative", source: "A reporter finds a sealed box.", outline: "", episodeNumber: 1, metadata: payload("x").metadata },
    });

    expect(adapter.requests.map((request) => request.taskType)).toEqual(["custom", "screenplay"]);
    expect(`${adapter.requests[0]?.systemPrompt ?? ""}\n${adapter.requests[0]?.userPrompt ?? ""}`).toContain("story outline");
    expect(result.outline).toContain("hidden witness");
    expect(result.version.generationContext?.outline).toBe(result.outline);
    expect((await repository.loadProjectGraph(project.id))?.screenplayVersions).toHaveLength(1);
  });

  it("supports creative and source entries and stores independent episode records", async () => {
    const repository = new InMemoryProjectRepository();
    const project = await repository.createProject("demo");
    const service = new ProjectService(repository, new ScreenplayAdaptationService());
    const creativeAdapter = new CapturingAdapter(payload("creative"));
    const first = await service.generateEpisode({ projectId: project.id, adapter: creativeAdapter, entryType: "creative", source: "A reporter finds a sealed box.", outline: "Episode arc", episodeNumber: 1, metadata: payload("x").metadata });
    const sourceAdapter = new CapturingAdapter(payload("source"));
    const second = await service.generateEpisode({ projectId: project.id, adapter: sourceAdapter, entryType: "source", source: "Novel chapter text", outline: "Episode arc", episodeNumber: 2, metadata: payload("x").metadata });

    expect(first.version.id).not.toBe(second.version.id);
    expect(first.version.episodeNumber).toBe(1);
    expect(second.version.episodeNumber).toBe(2);
    expect(secondAdapterPrompt(sourceAdapter)).toContain("Episode arc");
    expect(secondAdapterPrompt(sourceAdapter)).toContain(first.version.bodyMarkdown ?? "");
    expect((await repository.loadProjectGraph(project.id))?.screenplayVersions).toHaveLength(2);
  });

  it("does not save a version when generation fails", async () => {
    const repository = new InMemoryProjectRepository();
    const project = await repository.createProject("demo");
    const service = new ProjectService(repository, new ScreenplayAdaptationService());
    await expect(service.generateEpisode({ projectId: project.id, adapter: new CapturingAdapter(payload("x"), true), entryType: "creative", source: "premise", episodeNumber: 1, metadata: payload("x").metadata })).rejects.toThrow();
    expect((await repository.loadProjectGraph(project.id))?.screenplayVersions).toHaveLength(0);
  });
});

function secondAdapterPrompt(adapter: CapturingAdapter): string {
  const request = adapter.requests[0];
  return `${request?.systemPrompt ?? ""}\n${request?.userPrompt ?? ""}`;
}
