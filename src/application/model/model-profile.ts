import type { ModelProvider } from '../../domain/models';
import { OllamaAdapter } from '../../infrastructure/model/ollama-adapter';
import { OpenAICompatibleAdapter } from '../../infrastructure/model/openai-compatible-adapter';
import { createTauriModelAdapter } from '../../infrastructure/model/tauri-model-adapter';
import { getSecret, setSecret, deleteSecret } from '../../infrastructure/secret-store';

export interface ModelProfile {
  id: string;
  name: string;
  provider: ModelProvider;
  baseUrl: string;
  modelName: string;
  hasApiKey: boolean;
  wireApi?: "chat-completions" | "responses";
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ModelProfileInput {
  name: string;
  provider: ModelProvider;
  baseUrl: string;
  modelName: string;
  apiKey?: string;
  wireApi?: "chat-completions" | "responses";
  headers?: Record<string, string>;
}

const STORAGE_KEY = 'ai-drama-workbench:model-profiles:v1';
const ACTIVE_KEY = 'ai-drama-workbench:active-model-profile:v1';

function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function profileId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `model-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultProfiles(): ModelProfile[] {
  const now = new Date().toISOString();
  return [{ id: 'ollama-local', name: 'Ollama 本地', provider: 'ollama', baseUrl: 'http://127.0.0.1:11434', modelName: 'qwen2.5:7b', hasApiKey: false, createdAt: now, updatedAt: now }];
}

export function loadModelProfiles(): ModelProfile[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return defaultProfiles();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultProfiles();
    return parsed.filter((item): item is ModelProfile => Boolean(item && typeof item === 'object' && typeof (item as ModelProfile).id === 'string' && typeof (item as ModelProfile).name === 'string' && ['ollama', 'openai-compatible'].includes((item as ModelProfile).provider)));
  } catch { return defaultProfiles(); }
}

function persist(profiles: readonly ModelProfile[]): void { storage()?.setItem(STORAGE_KEY, JSON.stringify(profiles)); }

export function getActiveModelProfileId(): string { return storage()?.getItem(ACTIVE_KEY) ?? 'ollama-local'; }
export function setActiveModelProfileId(id: string): void { storage()?.setItem(ACTIVE_KEY, id); }

export async function saveModelProfile(input: ModelProfileInput, existingId?: string): Promise<ModelProfile> {
  if (!input.name.trim() || !input.baseUrl.trim() || !input.modelName.trim()) throw new Error('模型配置名称、Base URL 和模型名不能为空');
  try { new URL(input.baseUrl); } catch { throw new Error('Base URL 格式无效'); }
  const profiles = loadModelProfiles();
  const existing = existingId ? profiles.find((profile) => profile.id === existingId) : undefined;
  const now = new Date().toISOString();
  const normalizedBaseUrl = input.baseUrl.trim().replace(/\/$/, '');
  const isMaitokensProxy = normalizedBaseUrl.includes("maitokens.top");
  const selectedProvider: ModelProvider = isMaitokensProxy ? "openai-compatible" : input.provider;
  const proxyDefaults = isMaitokensProxy
    ? { wireApi: "responses" as const, headers: { "x-openai-actor-authorization": "local-image-extension" } }
    : { wireApi: "chat-completions" as const, headers: undefined };
  const selectedWireApi = isMaitokensProxy
    ? proxyDefaults.wireApi
    : input.wireApi ?? existing?.wireApi ?? proxyDefaults.wireApi;
  const selectedHeaders = isMaitokensProxy
    ? proxyDefaults.headers
    : input.headers ?? existing?.headers ?? proxyDefaults.headers;
  const profile: ModelProfile = { id: existing?.id ?? profileId(), name: input.name.trim(), provider: selectedProvider, baseUrl: normalizedBaseUrl, modelName: input.modelName.trim(), wireApi: selectedWireApi, headers: selectedHeaders, hasApiKey: Boolean(input.apiKey?.trim()) || Boolean(existing?.hasApiKey), createdAt: existing?.createdAt ?? now, updatedAt: now };
  if (input.apiKey?.trim()) await setSecret(`model-profile:${profile.id}:api-key`, input.apiKey.trim());
  if (!existing) persist([...profiles, profile]);
  else persist(profiles.map((item) => item.id === profile.id ? profile : item));
  return profile;
}

export function persistModelProfiles(profiles: readonly ModelProfile[]): void { persist(profiles); }

export async function removeModelProfile(id: string): Promise<void> {
  const profiles = loadModelProfiles();
  if (profiles.length <= 1) throw new Error('至少保留一个模型配置');
  persist(profiles.filter((profile) => profile.id !== id));
  await deleteSecret(`model-profile:${id}:api-key`);
  if (getActiveModelProfileId() === id) setActiveModelProfileId(profiles.find((profile) => profile.id !== id)?.id ?? '');
}

export async function createAdapterForProfile(profile: ModelProfile) {
  const apiKey = await getSecret(`model-profile:${profile.id}:api-key`);
  if (profile.provider === 'ollama') return new OllamaAdapter({ baseUrl: profile.baseUrl, modelName: profile.modelName });
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) return createTauriModelAdapter(profile, apiKey ?? undefined);
  return new OpenAICompatibleAdapter({ baseUrl: profile.baseUrl, modelName: profile.modelName, apiKey: apiKey ?? undefined, wireApi: profile.wireApi, headers: profile.headers });
}
