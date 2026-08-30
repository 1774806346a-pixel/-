import type { LockedFact, ScreenplayVersion, StoryBible } from "../../domain/models";
import type { SourceVoiceLedgerEntry } from "./source-voice-ledger";
import type { ModelAdapter } from "../model/model-adapter";
import { runGeneration } from "../model/generation-runner";
import { mergePromptLayers } from "../prompts/prompt-layers";
import { createScreenplayPromptLayers } from "../prompts/screenplay-prompts";
import { normalizeScreenplayCandidate } from "./screenplay-adaptation-service";
import type { AdaptationPromptOptions } from "../prompts/screenplay-prompts";
import { screenplaySchema } from "../../domain/schemas/screenplay.schema";
import { validateScreenplayFormat } from "../../domain/rules/screenplay-format-rules";
import { detectLockedFactChanges, detectProtectedTextChanges, type ChangeNotice } from "../../domain/rules/locked-facts";
import { diffScreenplayVersions, type VersionDiff } from "../../domain/versioning/version-diff";

export type RewriteScope = { readonly kind: "full" | "episode" | "scene" | "paragraph"; readonly episodeNumber?: number; readonly sceneId?: string; readonly paragraph?: string };
export interface RewriteRequest {
  readonly adapter: ModelAdapter;
  readonly projectId: string;
  readonly sourceVersion: ScreenplayVersion;
  readonly scope: RewriteScope;
  readonly userPrompt: string;
  readonly internalStrategy?: string;
  readonly storyBible?: StoryBible | null;
  readonly lockedFacts?: readonly LockedFact[];
  readonly protectedVoices?: readonly SourceVoiceLedgerEntry[];
  readonly signal?: AbortSignal;
}
export interface RewriteResult { readonly version: ScreenplayVersion; readonly diff: VersionDiff; readonly notices: readonly ChangeNotice[]; readonly promptVersion: string; }

export class ScreenplayRewriteService {
  async rewrite(request: RewriteRequest): Promise<RewriteResult> {
    const options: AdaptationPromptOptions = { source: request.sourceVersion.bodyMarkdown ?? JSON.stringify(request.sourceVersion), metadata: request.sourceVersion.metadata, userPrompt: `${request.internalStrategy ?? "Improve the target dimensions while preserving facts."}\nScope: ${JSON.stringify(request.scope)}\n${request.userPrompt}`, storyBible: request.storyBible, lockedFacts: request.lockedFacts };
    const merged = mergePromptLayers(createScreenplayPromptLayers(options));
    const generation = await runGeneration(request.adapter, { taskType: "rewrite", systemPrompt: merged.systemPrompt, userPrompt: merged.userPrompt, responseSchema: {}, temperature: 0.2 }, { signal: request.signal });
    let payload: unknown;
    try { payload = generation.value ?? JSON.parse(generation.text); } catch { throw new Error("Rewrite model output is not valid JSON"); }
    const candidate = normalizeScreenplayCandidate(payload as Record<string, unknown>, { ...options, adapter: request.adapter, projectId: request.projectId, parentVersionId: request.sourceVersion.id, sourceVersionId: request.sourceVersion.sourceVersionId });
    const version: ScreenplayVersion = { ...candidate, versionNumber: request.sourceVersion.versionNumber + 1, parentVersionId: request.sourceVersion.id, sourceVersionId: request.sourceVersion.sourceVersionId ?? request.sourceVersion.id, status: "draft" };
    const schema = screenplaySchema.safeParse(version);
    if (!schema.success) throw new Error(`Rewrite schema validation failed: ${schema.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    const format = validateScreenplayFormat(version);
    if (!format.valid) throw new Error(`Rewrite format validation failed: ${format.issues.map((issue) => issue.path).join(", ")}`);
    const locked = detectLockedFactChanges(request.sourceVersion, version, request.lockedFacts ?? []);
    const protectedText = request.protectedVoices?.length ? detectProtectedTextChanges(request.protectedVoices, version.scenes.flatMap((scene) => scene.dialogues).filter((line) => line.protected).map((line) => line.text)) : { valid: true, notices: [] as ChangeNotice[] };
    const diff = diffScreenplayVersions(request.sourceVersion, version, request.lockedFacts ?? []);
    const notices = [...locked.notices, ...protectedText.notices];
    return { version: { ...version, status: notices.length ? "pending-confirmation" : "draft" }, diff, notices, promptVersion: merged.promptVersion };
  }
}
