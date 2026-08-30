export type WorkflowTaskStatus = "idle" | "ready" | "running" | "succeeded" | "failed" | "cancelled";
export interface WorkflowTask<T = unknown> { id: string; status: WorkflowTaskStatus; attempt: number; inputVersionId?: string; result?: T; error?: string; log: string[]; updatedAt: string; }

export class WorkflowTaskService<T = unknown> {
  private readonly tasks = new Map<string, WorkflowTask<T>>();
  private readonly controllers = new Map<string, AbortController>();
  get(id: string) { return this.tasks.get(id); }
  list() { return [...this.tasks.values()]; }
  async run(id: string, work: (signal: AbortSignal) => Promise<T>, inputVersionId?: string): Promise<WorkflowTask<T>> {
    const previous = this.tasks.get(id);
    if (previous?.status === "succeeded") return previous;
    const task: WorkflowTask<T> = { id, status: "running", attempt: (previous?.attempt ?? 0) + 1, inputVersionId, log: [...(previous?.log ?? []), `attempt ${(previous?.attempt ?? 0) + 1}`], updatedAt: new Date().toISOString() };
    this.tasks.set(id, task);
    const controller = new AbortController(); this.controllers.set(id, controller);
    try { const result = await work(controller.signal); const done = { ...task, status: "succeeded" as const, result, updatedAt: new Date().toISOString(), log: [...task.log, "succeeded"] }; this.tasks.set(id, done); return done; }
    catch (error) { const cancelled = controller.signal.aborted; const failed = { ...task, status: cancelled ? "cancelled" as const : "failed" as const, error: error instanceof Error ? error.message.replace(/(?:api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, "$1=[REDACTED]") : "Task failed", updatedAt: new Date().toISOString(), log: [...task.log, cancelled ? "cancelled" : "failed"] }; this.tasks.set(id, failed); return failed; }
    finally { this.controllers.delete(id); }
  }
  cancel(id: string): void { this.controllers.get(id)?.abort(); }
  retry(id: string, work: (signal: AbortSignal) => Promise<T>): Promise<WorkflowTask<T>> { const task = this.tasks.get(id); if (!task || !["failed", "cancelled"].includes(task.status)) throw new Error("Only failed or cancelled tasks can be retried"); if (task.attempt >= 3) throw new Error("Maximum retry attempts reached"); return this.run(id, work, task.inputVersionId); }
}
