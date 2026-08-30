import { describe, expect, it } from "vitest";
import { calculateOverallScore, weightsForTarget } from "../../src/domain/scoring/score-calculator";

describe("target scoring", () => {
  it("normalizes weights per target profile", () => expect(Object.values(weightsForTarget("AI漫剧")).reduce((a, b) => a + b, 0)).toBeCloseTo(1));
  it("calculates a weighted score", () => expect(calculateOverallScore([{ key: "hook", score: 100 }, { key: "conflict", score: 0 }], "竖屏短剧")).toBeGreaterThan(0));
});
