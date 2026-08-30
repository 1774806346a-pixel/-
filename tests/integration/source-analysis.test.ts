import { describe, expect, it } from "vitest";
import { SourceAnalysisService } from "../../src/application/services/source-analysis-service";

describe("source analysis", () => {
  it("keeps screenplay parsing deterministic and source locations", async () => {
    const result = await new SourceAnalysisService().analyze({ inputType: "screenplay", input: "# Episode 1\n## 1-1 INT. ROOM\nAlice: Hello\nAction: opens door\nUnknown free text" });
    expect(result.deterministic).toBe(true);
    expect(result.analysis.inputType).toBe("screenplay");
    expect(result.analysis.dialogue[0]?.sourceLocation?.lineStart).toBe(3);
    expect(result.analysis.pendingConfirmations.length).toBeGreaterThan(0);
    expect(result.analysis.structureNodes.some((node) => node.needsReview)).toBe(true);
  });

  it("requires an adapter for non-screenplay sources", async () => {
    await expect(new SourceAnalysisService().analyze({ inputType: "novel", input: "A long chapter" })).rejects.toThrow(/adapter/i);
  });
});
