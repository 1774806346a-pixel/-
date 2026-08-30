import { classifyModelError, ModelError } from "../../application/model/model-errors";

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 120_000, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new ModelError("timeout", "模型请求超时")), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetchImpl(input, { ...init, signal: controller.signal });
    if (!response.ok) {
      let detail = "";
      try { detail = await response.text(); } catch { /* response body is optional */ }
      throw classifyModelError(new Error(detail || response.statusText), response.status);
    }
    return response;
  } catch (error) {
    if (error instanceof ModelError) throw error;
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw new ModelError(signal?.aborted ? "cancelled" : "timeout", signal?.aborted ? "生成任务已取消" : "模型请求超时", { cause: error });
    throw classifyModelError(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function readTextStream(response: Response, onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let all = "";
  try {
    while (true) {
      if (signal?.aborted) throw new ModelError("cancelled", "生成任务已取消");
      const result = await reader.read();
      if (result.done) break;
      const chunk = decoder.decode(result.value, { stream: true });
      all += chunk;
      onChunk(chunk);
    }
    const tail = decoder.decode();
    if (tail) { all += tail; onChunk(tail); }
    return all;
  } finally { reader.releaseLock(); }
}
