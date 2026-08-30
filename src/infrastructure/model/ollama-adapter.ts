import type { GenerationEvent, GenerationRequest, ModelAdapter, ModelConnectionResult } from "../../application/model/model-adapter";
import { createRequestId, throwIfAborted } from "../../application/model/model-adapter";
import { classifyModelError, ModelError } from "../../application/model/model-errors";
import { fetchWithTimeout } from "./http-utils";
import { parseModelJson } from "../../application/model/json-output";

export interface OllamaAdapterOptions { baseUrl?: string; modelName: string; fetchImpl?: typeof fetch; }

export class OllamaAdapter implements ModelAdapter {
  readonly provider = "ollama" as const;
  readonly modelName: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  constructor(options: OllamaAdapterOptions) { this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, ""); this.modelName = options.modelName; this.fetchImpl = options.fetchImpl ?? fetch; }
  async testConnection(signal?: AbortSignal): Promise<ModelConnectionResult> { const started = performance.now(); try { await this.fetchImpl(`${this.baseUrl}/api/tags`, { signal }); return { ok: true, provider: this.provider, message: "Ollama 已连接", latencyMs: Math.round(performance.now() - started) }; } catch (error) { throw new ModelError("service-not-running", "Ollama 服务未启动或无法访问", { cause: error }); } }
  async listModels(signal?: AbortSignal): Promise<readonly string[]> { try { const response = await fetchWithTimeout(`${this.baseUrl}/api/tags`, { signal }, 15_000, signal, this.fetchImpl); const payload = await response.json() as { models?: Array<{ name?: string }> }; return (payload.models ?? []).flatMap((model) => model.name ? [model.name] : []); } catch (error) { throw classifyModelError(error); } }
  async *generate(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<GenerationEvent> {
    const requestId = createRequestId(); yield { type: "started", requestId }; if (signal?.aborted) { yield { type: "failed", error: new ModelError("cancelled", "生成任务已取消") }; return; }
    const body = { model: this.modelName, stream: true, prompt: request.userPrompt, ...(request.systemPrompt ? { system: request.systemPrompt } : {}), options: { ...(request.temperature === undefined ? {} : { temperature: request.temperature }), ...(request.maxOutputTokens === undefined ? {} : { num_predict: request.maxOutputTokens }) }, format: request.responseSchema ? "json" : undefined };
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal }, request.timeoutMs, signal, this.fetchImpl);
      if (!response.body) throw new ModelError("server", "Ollama 返回空响应");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let output = "";
      try { while (true) { throwIfAborted(signal); const next = await reader.read(); if (next.done) break; buffer += decoder.decode(next.value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) { if (!line.trim()) continue; const item = JSON.parse(line) as { response?: string; done?: boolean; error?: string }; if (item.error) throw new ModelError("server", item.error); if (item.response) { output += item.response; yield { type: "delta", text: item.response }; } } } if (buffer.trim()) { const item = JSON.parse(buffer) as { response?: string }; if (item.response) { output += item.response; yield { type: "delta", text: item.response }; } } } finally { reader.releaseLock(); }
      let value: unknown; if (request.responseSchema) { try { value = parseModelJson(output); yield { type: "validated", value }; } catch (error) { throw new ModelError("schema-invalid", "模型返回内容不是合法 JSON", { retryable: false, cause: error }); } }
      yield { type: "completed", text: output, ...(value === undefined ? {} : { value }) };
    } catch (error) { const modelError = classifyModelError(error); yield { type: "failed", error: modelError }; }
  }
}
