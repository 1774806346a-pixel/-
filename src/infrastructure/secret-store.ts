import { invoke } from "@tauri-apps/api/core";

const memory = new Map<string, string>();
export type SecretStorageMode = "windows-credential-manager" | "memory-fallback";
const tauriRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
/** API keys never enter project files, localStorage, logs, or exports. */
export let secretStorageMode: SecretStorageMode = tauriRuntime ? "windows-credential-manager" : "memory-fallback";
export function isSecureSecretStorageAvailable(): boolean { return secretStorageMode === "windows-credential-manager"; }
function fallback(): void { secretStorageMode = "memory-fallback"; }
export function isTauriSecretStorageAvailable(): boolean { return tauriRuntime && secretStorageMode === "windows-credential-manager"; }
export async function setSecret(key: string, value: string): Promise<void> {
  if (isTauriSecretStorageAvailable()) {
    try { await invoke("secret_set", { key, value }); return; } catch { fallback(); }
  }
  memory.set(key, value);
}
export async function getSecret(key: string): Promise<string | null> {
  if (isTauriSecretStorageAvailable()) {
    try { return await invoke<string | null>("secret_get", { key }); } catch { fallback(); }
  }
  return memory.get(key) ?? null;
}
export async function deleteSecret(key: string): Promise<void> {
  if (isTauriSecretStorageAvailable()) {
    try { await invoke("secret_delete", { key }); return; } catch { fallback(); }
  }
  memory.delete(key);
}
export function redactSecrets(value: string, secrets: readonly string[]): string { return secrets.filter(Boolean).reduce((text, secret) => text.split(secret).join('[REDACTED]'), value).replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]').replace(/(api[_-]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]'); }
