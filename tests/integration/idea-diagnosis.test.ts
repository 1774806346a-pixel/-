import { describe, expect, it } from "vitest";
import { IdeaDiagnosisService } from "../../src/application/services/idea-diagnosis-service";
import type { GenerationEvent, ModelAdapter } from "../../src/application/model/model-adapter";

function adapter(payload: unknown): ModelAdapter {
  return { provider: "ollama", modelName: "test", async testConnection() { return { ok: true, provider: "ollama", message: "ok" }; }, async listModels() { return []; }, async *generate(): AsyncIterable<GenerationEvent> { yield { type: "completed", text: JSON.stringify(payload), value: payload }; } };
}

describe("idea diagnosis", () => {
  it("returns structured diagnosis with risks and pending questions", async () => {
    const result = await new IdeaDiagnosisService().diagnose({ input: "A courier discovers a locked city", adapter: adapter({ summary: "A courier discovers a locked city", characters: [{ name: "Courier" }], conflicts: [{ description: "Escape the city" }], events: [{ description: "Discovers the lock" }], structureNodes: [{ id: "hook", type: "hook", title: "Discovery" }], dialogue: [], actions: [], pendingConfirmations: ["Why is the city locked?"], sourceLocations: [], modelMetadata: {} }) });
    expect(result.diagnosis.inputType).toBe("idea");
    expect(result.diagnosis.conflicts).toHaveLength(1);
    expect(result.diagnosis.pendingConfirmations).toContain("Why is the city locked?");
  });

  it("rejects invalid model JSON", async () => {
    const bad = adapter({ summary: "", characters: [], conflicts: [], events: [], structureNodes: [], dialogue: [], actions: [], pendingConfirmations: [], sourceLocations: [], modelMetadata: {} });
    await expect(new IdeaDiagnosisService().diagnose({ input: "idea", adapter: bad })).rejects.toMatchObject({ code: "schema-invalid" });
  });
});
