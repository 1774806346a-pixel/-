export interface TaskState { id: string; status: 'running' | 'completed' | 'failed' | 'cancelled'; error?: string; }
export class TaskManager { private readonly controllers = new Map<string, AbortController>();
  start(id: string): AbortSignal { const controller = new AbortController(); this.controllers.set(id, controller); return controller.signal; }
  cancel(id: string): void { this.controllers.get(id)?.abort(); this.controllers.delete(id); }
  clear(id: string): void { this.controllers.delete(id); }
}
