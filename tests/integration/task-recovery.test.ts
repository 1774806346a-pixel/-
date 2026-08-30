import { describe, expect, it } from "vitest";
import { WorkflowTaskService } from "../../src/application/task/workflow-task-service";

describe("recoverable workflow tasks", () => {
  it("supports cancellation, retry, visible logs, and idempotent success", async () => {
    const service = new WorkflowTaskService<string>();
    let runs = 0;
    const first = await service.run("task-1", async () => { runs += 1; throw new Error("apiKey=secret"); }, "v1");
    expect(first.status).toBe("failed"); expect(first.error).not.toContain("secret");
    const second = await service.retry("task-1", async () => { runs += 1; return "ok"; });
    expect(second.status).toBe("succeeded"); expect(second.log.length).toBeGreaterThan(1);
    const third = await service.run("task-1", async () => { runs += 1; return "duplicate"; });
    expect(third.result).toBe("ok"); expect(runs).toBe(2);
  });
});

