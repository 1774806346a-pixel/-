import { describe, expect, it, vi } from "vitest";
import { OllamaAdapter } from "../../src/infrastructure/model/ollama-adapter";
import { OpenAICompatibleAdapter } from "../../src/infrastructure/model/openai-compatible-adapter";
import { runGeneration } from "../../src/application/model/generation-runner";

function streamResponse(chunks: string[], contentType = "application/json") {
  const body = new ReadableStream({ start(controller) { chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk))); controller.close(); } });
  return new Response(body, { status: 200, headers: { "content-type": contentType } });
}

describe("model adapters", () => {
  it("streams Ollama NDJSON and validates JSON output", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => input.toString().endsWith("/api/tags") ? new Response(JSON.stringify({ models: [{ name: "qwen" }] })) : streamResponse(['{"response":"{\\"ok\\":","done":false}\n', '{"response":"true}","done":true}\n']));
    const adapter = new OllamaAdapter({ modelName: "qwen", fetchImpl });
    expect(await adapter.listModels()).toEqual(["qwen"]);
    const result = await runGeneration(adapter, { taskType: "custom", userPrompt: "test", responseSchema: { type: "object" } });
    expect(result.value).toEqual({ ok: true });
    expect(result.text).toBe('{"ok":true}');
  });
  it("accepts fenced JSON returned by Ollama", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => streamResponse(['{"response":"```json\\n{\\"ok\\":true}\\n```","done":true}\n']));
    const adapter = new OllamaAdapter({ modelName: "qwen", fetchImpl });
    const result = await runGeneration(adapter, { taskType: "custom", userPrompt: "test", responseSchema: { type: "object" } });
    expect(result.value).toEqual({ ok: true });
  });
  it("streams OpenAI-compatible SSE and supports abort", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => streamResponse(['data: {"choices":[{"delta":{"content":"你好"}}]}\n\n', 'data: [DONE]\n\n'], "text/event-stream"));
    const adapter = new OpenAICompatibleAdapter({ baseUrl: "https://example.test/v1", modelName: "model", apiKey: "secret", fetchImpl });
    const result = await runGeneration(adapter, { taskType: "custom", userPrompt: "test" });
    expect(result.text).toBe("你好");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ headers: { authorization: "Bearer secret" } });
    const controller = new AbortController(); controller.abort();
    const events = []; for await (const event of adapter.generate({ taskType: "custom", userPrompt: "test" }, controller.signal)) events.push(event);
    expect(events.at(-1)?.type).toBe("failed");
  });
  it("tests a Responses API proxy with its actual endpoint and custom headers", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ output_text: "pong" }), { status: 200 }));
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://proxy.example.test/v1/",
      modelName: "gpt-5.5",
      wireApi: "responses",
      headers: { "x-openai-actor-authorization": "local-image-extension" },
      fetchImpl,
    });

    const result = await adapter.testConnection();
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://proxy.example.test/v1/responses");
    expect(init).toMatchObject({ method: "POST", headers: {
      "content-type": "application/json",
      "x-openai-actor-authorization": "local-image-extension",
    } });
    expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "gpt-5.5", input: "ping", stream: false });
  });

  it("accepts a JSON Responses response without a ReadableStream body", async () => {
    const response = {
      ok: true,
      status: 200,
      statusText: "OK",
      body: null,
      json: async () => ({ output_text: "{\"ok\":true}" }),
    } as unknown as Response;
    const fetchImpl = vi.fn<typeof fetch>(async () => response);
    const adapter = new OpenAICompatibleAdapter({ baseUrl: "https://proxy.example.test/v1", modelName: "gpt-5.5", wireApi: "responses", fetchImpl });
    const result = await runGeneration(adapter, { taskType: "custom", userPrompt: "test", responseSchema: { type: "object" } });
    expect(result.text).toBe('{"ok":true}');
    expect(result.value).toEqual({ ok: true });
  });
});
