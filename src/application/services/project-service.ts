import type { Asset, BoardPrompt, ProjectGraph, ScreenplayVersion, SourceDocument } from '../../domain/models';
import type { ProjectRepository } from '../../infrastructure/project-repository';
import type { ModelAdapter } from '../model/model-adapter';
import { ScreenplayAdaptationService, type AdaptScreenplayResult } from './screenplay-adaptation-service';
import type { AdaptationPromptOptions } from '../prompts/screenplay-prompts';
import { buildEpisodeContext } from '../../domain/episodic-workflow';

export interface GenerateEpisodeRequest extends AdaptationPromptOptions {
  readonly projectId: string;
  readonly adapter: ModelAdapter;
  readonly signal?: AbortSignal;
}

export class ProjectService {
  constructor(private readonly repository: ProjectRepository, private readonly adaptation = new ScreenplayAdaptationService()) {}
  create(name: string) { return this.repository.createProject(name); }
  rename(id: string, name: string) { return this.repository.renameProject(id, name); }
  list(includeDeleted = false) { return this.repository.listProjects(includeDeleted); }
  load(id: string): Promise<ProjectGraph | null> { return this.repository.loadProjectGraph(id); }
  remove(id: string) { return this.repository.softDeleteProject(id); }
  deletePermanently(id: string) { return this.repository.deleteProjectPermanently(id); }
  restore(id: string) { return this.repository.restoreProject(id); }
  saveSource(document: SourceDocument) { return this.repository.saveSourceDocument(document); }
  saveVersion(version: ScreenplayVersion) { return this.repository.saveVersion(version); }
  loadProjectAssets(projectId: string) { return this.repository.loadProjectAssets(projectId); }
  saveProjectAssets(projectId: string, assets: readonly Asset[], boardPrompts: readonly BoardPrompt[]) { return this.repository.saveProjectAssets(projectId, assets, boardPrompts); }

  /** Generate and persist one immutable episode record. Persistence happens only after validation succeeds. */
  async generateEpisode(request: GenerateEpisodeRequest): Promise<AdaptScreenplayResult> {
    const episodeNumber = Number.isInteger(request.episodeNumber) && (request.episodeNumber ?? 0) > 0 ? request.episodeNumber! : 1;
    const graph = await this.repository.loadProjectGraph(request.projectId);
    if (!graph) throw new Error(`Project does not exist: ${request.projectId}`);
    const prior = [...graph.screenplayVersions]
      .filter((version) => typeof version.episodeNumber === 'number' && version.episodeNumber < episodeNumber)
      .sort((a, b) => (a.episodeNumber! - b.episodeNumber!))
      .map((version) => ({ episodeNumber: version.episodeNumber!, screenplay: version.bodyMarkdown ?? "" }));
    const episodeContext = buildEpisodeContext({ episodeNumber, previousEpisodes: request.previousEpisodes ?? prior, referenceEpisodeNumbers: request.referenceEpisodeNumbers });
    const adapted = await this.adaptation.adapt({
      ...request,
      episodeNumber,
      previousEpisodes: episodeContext.previousEpisodes,
      referenceEpisodeNumbers: undefined,
      parentVersionId: undefined,
    });
    const context = {
      entryType: request.entryType ?? "source",
      source: request.source,
      ...(request.outline?.trim() ? { outline: request.outline.trim() } : {}),
      previousEpisodes: episodeContext.previousEpisodes,
    } as NonNullable<ScreenplayVersion["generationContext"]>;
    const version: ScreenplayVersion = {
      ...adapted.version,
      episodeNumber,
      entryType: context.entryType,
      generationContext: context,
      versionNumber: episodeNumber,
    };
    const saved = await this.repository.saveVersion(version);
    return { ...adapted, version: saved };
  }
}
