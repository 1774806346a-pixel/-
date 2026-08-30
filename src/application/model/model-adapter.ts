import type { ModelProvider } from "../../domain/models";
import { ModelError } from "./model-errors";

export type GenerationTaskType = "screenplay" | "score" | "rewrite" | "assets" | "board-prompt" | "shot-group" | "custom";

export interface GenerationRequest {
  taskType: GenerationTaskType;
  systemPrompt?: string;
  userPrompt: string;
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  retries?: number;
}

export type GenerationEvent =
  | { type: "started"; requestId: string }
  | { type: "delta"; text: string }
  | { type: "validated"; value: unknown }
  | { type: "completed"; text: string; value?: unknown }
  | { type: "failed"; error: ModelError };

export interface ModelConnectionResult { ok: boolean; provider: ModelProvider; message: string; latencyMs?: number; }

export interface ModelAdapter {
  readonly provider: ModelProvider;
  readonly modelName: string;
  testConnection(signal?: AbortSignal): Promise<ModelConnectionResult>;
  listModels(signal?: AbortSignal): Promise<readonly string[]>;
  generate(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<GenerationEvent>;
}

export function createRequestId(): string { return globalThis.crypto?.randomUUID?.() ?? `generation-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

export function throwIfAborted(signal?: AbortSignal): void { if (signal?.aborted) throw new ModelError("cancelled", "生成任务已取消"); }
