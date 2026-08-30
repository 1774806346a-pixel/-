import type { LockedFact, ScreenplayVersion, StoryBible } from "../../domain/models";
import type { ModelAdapter } from "../model/model-adapter";
import { ScreenplayRewriteService, type RewriteResult, type RewriteScope } from "./screenplay-rewrite-service";

export interface RewriteRecord {
  id: string;
  projectId: string;
  sourceVersionId: string;
  candidateVersionId: string;
  scope: RewriteScope;
  userPrompt: string;
  model: { provider: string; modelName: string; promptVersion: string };
  changeSummary: string;
  lockedFactImpact: number;
  createdAt: string;
}

export interface RewriteVersionRepository { saveVersion(version: ScreenplayVersion): Promise<ScreenplayVersion>; }

export interface RewriteWorkflowRequest {
  adapter: ModelAdapter;
  projectId: string;
  sourceVersion: ScreenplayVersion;
  scope: RewriteScope;
  userPrompt: string;
  storyBible?: StoryBible | null;
  lockedFacts?: readonly LockedFact[];
  signal?: AbortSignal;
}

export interface RewriteWorkflowResult extends RewriteResult { record: RewriteRecord; }

export class RewriteWorkflowService {
  constructor(private readonly repository: RewriteVersionRepository, private readonly rewrite = new ScreenplayRewriteService()) {}

  async generate(request: RewriteWorkflowRequest): Promise<RewriteWorkflowResult> {
    const result = await this.rewrite.rewrite(request);
    const now = new Date().toISOString();
    return { ...result, record: { id: globalThis.crypto?.randomUUID?.() ?? `rewrite-${Date.now()}`, projectId: request.projectId, sourceVersionId: request.sourceVersion.id, candidateVersionId: result.version.id, scope: request.scope, userPrompt: request.userPrompt, model: { provider: request.adapter.provider, modelName: request.adapter.modelName, promptVersion: result.promptVersion }, changeSummary: `${result.diff.entries.length} changes`, lockedFactImpact: result.notices.length, createdAt: now } };
  }

  async confirm(result: RewriteWorkflowResult, confirmations: readonly string[] = []): Promise<ScreenplayVersion> {
    const unresolved = result.notices.filter((notice) => notice.requiresConfirmation && !confirmations.includes(notice.id));
    if (unresolved.length) throw new Error("Rewrite contains unconfirmed locked-fact changes");
    return this.repository.saveVersion({ ...result.version, status: "confirmed", updatedAt: new Date().toISOString() });
  }
}

