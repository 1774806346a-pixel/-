export const modelErrorCodes = [
  "network",
  "service-not-running",
  "auth",
  "quota",
  "context-limit",
  "timeout",
  "cancelled",
  "schema-invalid",
  "server",
] as const;

export type ModelErrorCode = (typeof modelErrorCodes)[number];

export class ModelError extends Error {
  readonly code: ModelErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(code: ModelErrorCode, message: string, options: { retryable?: boolean; status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = "ModelError";
    this.code = code;
    this.retryable = options.retryable ?? ["network", "service-not-running", "quota", "timeout", "server"].includes(code);
    this.status = options.status;
    this.cause = options.cause;
  }
}

/** Converts errors crossing the Tauri boundary into a useful user-facing line. */
export function describeModelError(error: unknown): string {
  if (error instanceof ModelError) {
    const prefix = [error.code, error.status ? `HTTP ${error.status}` : ""].filter(Boolean).join(" / ");
    return prefix ? `${prefix}: ${error.message}` : error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; error?: unknown; details?: unknown };
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
    if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error;
    if (typeof candidate.details === "string" && candidate.details.trim()) return candidate.details;
    try { return JSON.stringify(error); } catch { /* fall through */ }
  }
  return "模型请求失败，请检查 Base URL、模型名和 API Key";
}

export function classifyModelError(error: unknown, status?: number): ModelError {
  if (error instanceof ModelError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new ModelError("cancelled", "生成任务已取消", { retryable: false, cause: error });
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (status === 401 || status === 403 || normalized.includes("unauthorized") || normalized.includes("api key")) return new ModelError("auth", "模型鉴权失败，请检查 API Key", { status, retryable: false, cause: error });
  if (status === 429 || normalized.includes("quota") || normalized.includes("rate limit")) return new ModelError("quota", "模型请求额度或速率受限", { status, cause: error });
  if (normalized.includes("context") || normalized.includes("maximum context") || normalized.includes("too many tokens")) return new ModelError("context-limit", "输入超过模型上下文长度限制", { status, retryable: false, cause: error });
  if (normalized.includes("timeout") || normalized.includes("timed out")) return new ModelError("timeout", "模型请求超时", { status, cause: error });
  if (status !== undefined && status >= 500) return new ModelError("server", `模型服务端错误 (${status})`, { status, cause: error });
  if (normalized.includes("failed to fetch") || normalized.includes("network") || normalized.includes("econnrefused")) return new ModelError("network", "无法连接模型服务", { status, cause: error });
  return new ModelError("server", message || "模型请求失败", { status, cause: error });
}
