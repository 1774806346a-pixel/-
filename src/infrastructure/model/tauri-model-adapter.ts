import { invoke } from "@tauri-apps/api/core";
import type { GenerationEvent, GenerationRequest, ModelAdapter, ModelConnectionResult } from "../../application/model/model-adapter";
import { createRequestId } from "../../application/model/model-adapter";
import { ModelError } from "../../application/model/model-errors";
import type { ModelProfile } from "../../application/model/model-profile";
import { parseModelJson } from "../../application/model/json-output";

export function createTauriModelAdapter(profile: ModelProfile, apiKey: string | undefined): ModelAdapter {
  return {
    provider: profile.provider,
    modelName: profile.modelName,
    async testConnection(): Promise<ModelConnectionResult> {
      const started = performance.now();
      const result = await invoke<{ latencyMs: number; endpoint: string }>("test_model_connection", {
        input: {
          baseUrl: profile.baseUrl,
          modelName: profile.modelName,
          apiKey,
          wireApi: profile.wireApi,
          headers: profile.headers,
        },
      });
      return { ok: true, provider: profile.provider, message: `模型服务已连接 (${result.endpoint})`, latencyMs: result.latencyMs ?? Math.round(performance.now() - started) };
    },
    async listModels() { return []; },
    async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
      const requestId = createRequestId(); yield { type: "started", requestId };
      try {
        const result = await invoke<{ text: string }>("generate_model", { input: { provider: profile.provider, baseUrl: profile.baseUrl, modelName: profile.modelName, apiKey, wireApi: profile.wireApi, headers: profile.headers, systemPrompt: request.systemPrompt, userPrompt: request.userPrompt, maxOutputTokens: request.maxOutputTokens } });
        if (result.text) yield { type: "delta", text: result.text };
        let value: unknown; if (request.responseSchema) { try { value = parseModelJson(result.text); yield { type: "validated", value }; } catch (error) { throw new ModelError("schema-invalid", "模型返回内容不是合法 JSON", { retryable: false, cause: error }); } }
        yield { type: "completed", text: result.text, ...(value === undefined ? {} : { value }) };
      } catch (error) { yield { type: "failed", error: error instanceof ModelError ? error : new ModelError("server", error instanceof Error ? error.message : String(error)) }; }
    },
  };
}
