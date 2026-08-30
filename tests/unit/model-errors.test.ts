import { describe, expect, it } from "vitest";
import { classifyModelError, ModelError } from "../../src/application/model/model-errors";

describe("model error classification", () => {
  it("maps auth, quota and context failures", () => {
    expect(classifyModelError(new Error("unauthorized"), 401).code).toBe("auth");
    expect(classifyModelError(new Error("rate limit"), 429).code).toBe("quota");
    expect(classifyModelError(new Error("maximum context length")).code).toBe("context-limit");
  });
  it("recognizes cancellation and preserves retryability", () => {
    const error = classifyModelError(new DOMException("aborted", "AbortError"));
    expect(error).toBeInstanceOf(ModelError);
    expect(error.code).toBe("cancelled");
    expect(error.retryable).toBe(false);
  });
});
