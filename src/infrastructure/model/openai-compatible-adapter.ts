import type { GenerationEvent, GenerationRequest, ModelAdapter, ModelConnectionResult } from "../../application/model/model-adapter";
import { createRequestId, throwIfAborted } from "../../application/model/model-adapter";
import { classifyModelError, ModelError } from "../../application/model/model-errors";
import { fetchWithTimeout } from "./http-utils";
import { parseModelJson } from "../../application/model/json-output";

export interface OpenAICompatibleAdapterOptions { baseUrl: string; modelName: string; apiKey?: string; wireApi?: "chat-completions" | "responses"; headers?: Record<string, string>; fetchImpl?: typeof fetch; }

export class OpenAICompatibleAdapter implements ModelAdapter {
  readonly provider = "openai-compatible" as const;
  readonly modelName: string;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly wireApi: "chat-completions" | "responses";
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  constructor(options: OpenAICompatibleAdapterOptions) { this.baseUrl = options.baseUrl.replace(/\/$/, ""); this.modelName = options.modelName; this.apiKey = options.apiKey; this.wireApi = options.wireApi ?? "chat-completions"; this.extraHeaders = options.headers ?? {}; this.fetchImpl = options.fetchImpl ?? fetch; }
  private headers(): HeadersInit { return { "content-type": "application/json", ...this.extraHeaders, ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) }; }
  async testConnection(signal?: AbortSignal): Promise<ModelConnectionResult> {
    const started = performance.now();
    try {
      const request = this.wireApi === "responses"
        ? {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ model: this.modelName, input: "ping", max_output_tokens: 1, stream: false }),
            signal,
          }
        : { headers: this.headers(), signal };
      await fetchWithTimeout(
        this.wireApi === "responses" ? `${this.baseUrl}/responses` : `${this.baseUrl}/models`,
        request,
        15_000,
        signal,
        this.fetchImpl,
      );
      return { ok: true, provider: this.provider, message: "兼容 API 已连接", latencyMs: Math.round(performance.now() - started) };
    } catch (error) {
      throw classifyModelError(error);
    }
  }
  async listModels(signal?: AbortSignal): Promise<readonly string[]> { const response = await fetchWithTimeout(`${this.baseUrl}/models`, { headers: this.headers(), signal }, 15_000, signal, this.fetchImpl); const payload = await response.json() as { data?: Array<{ id?: string }> }; return (payload.data ?? []).flatMap((model) => model.id ? [model.id] : []); }
  async *generate(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<GenerationEvent> {
    const requestId = createRequestId(); yield { type: "started", requestId }; if (signal?.aborted) { yield { type: "failed", error: new ModelError("cancelled", "生成任务已取消") }; return; } let output = "";
    try {
      const endpoint = this.wireApi === "responses" ? `${this.baseUrl}/responses` : `${this.baseUrl}/chat/completions`;
      const body = this.wireApi === "responses"
        ? { model: this.modelName, instructions: request.systemPrompt, input: request.userPrompt, temperature: request.temperature, max_output_tokens: request.maxOutputTokens, stream: false }
        : { model: this.modelName, stream: true, messages: [...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []), { role: "user", content: request.userPrompt }], temperature: request.temperature, max_tokens: request.maxOutputTokens, response_format: request.responseSchema ? { type: "json_object" } : undefined };
      const response = await fetchWithTimeout(endpoint, { method: "POST", headers: this.headers(), body: JSON.stringify(body), signal }, request.timeoutMs, signal, this.fetchImpl);
      if (this.wireApi === "responses") {
        const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
        output = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
        if (output) yield { type: "delta", text: output };
        let parsed: unknown; if (request.responseSchema) { try { parsed = parseModelJson(output); yield { type: "validated", value: parsed }; } catch (error) { throw new ModelError("schema-invalid", "模型返回内容不是合法 JSON", { retryable: false, cause: error }); } }
        yield { type: "completed", text: output, ...(parsed === undefined ? {} : { value: parsed }) };
        return;
      }
      if (!response.body) throw new ModelError("server", "兼容 API 返回空响应");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      try { while (true) { throwIfAborted(signal); const next = await reader.read(); if (next.done) break; buffer += decoder.decode(next.value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) { const value = line.trim().replace(/^data:\s*/, ""); if (!value || value === "[DONE]") continue; const item = JSON.parse(value) as { choices?: Array<{ delta?: { content?: string } }> }; const delta = item.choices?.[0]?.delta?.content; if (delta) { output += delta; yield { type: "delta", text: delta }; } } } } finally { reader.releaseLock(); }
      let parsed: unknown; if (request.responseSchema) { try { parsed = parseModelJson(output); yield { type: "validated", value: parsed }; } catch (error) { throw new ModelError("schema-invalid", "模型返回内容不是合法 JSON", { retryable: false, cause: error }); } }
      yield { type: "completed", text: output, ...(parsed === undefined ? {} : { value: parsed }) };
    } catch (error) { yield { type: "failed", error: classifyModelError(error) }; }
  }
}
