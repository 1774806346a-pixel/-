import type { Asset, BoardPrompt, Project, ProjectGraph, ScreenplayVersion, SourceDocument, StoryBible } from '../domain/models';

export interface ProjectRepository {
  createProject(name: string): Promise<Project>;
  renameProject(id: string, name: string): Promise<Project>;
  listProjects(includeDeleted?: boolean): Promise<readonly Project[]>;
  loadProjectGraph(id: string): Promise<ProjectGraph | null>;
  softDeleteProject(id: string): Promise<void>;
  deleteProjectPermanently(id: string): Promise<void>;
  restoreProject(id: string): Promise<Project>;
  saveSourceDocument(document: SourceDocument): Promise<SourceDocument>;
  saveVersion(version: ScreenplayVersion): Promise<ScreenplayVersion>;
  saveStoryBible(bible: StoryBible): Promise<StoryBible>;
  loadProjectAssets(projectId: string): Promise<{ assets: Asset[]; boardPrompts: BoardPrompt[] }>;
  saveProjectAssets(projectId: string, assets: readonly Asset[], boardPrompts: readonly BoardPrompt[]): Promise<void>;
}

const now = () => new Date().toISOString();
const id = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, Project>();
  private readonly sources = new Map<string, SourceDocument>();
  private readonly versions = new Map<string, ScreenplayVersion>();
  private readonly bibles = new Map<string, StoryBible>();
  private readonly assets = new Map<string, Asset>();
  private readonly boardPrompts = new Map<string, BoardPrompt>();

  async createProject(name: string): Promise<Project> {
    const timestamp = now();
    const project: Project = { id: id(), name: name.trim() || '未命名项目', schemaVersion: 1, createdAt: timestamp, updatedAt: timestamp, sourceDocumentIds: [], activeVersionId: null, storyBibleId: null };
    this.projects.set(project.id, project);
    return project;
  }

  async renameProject(projectId: string, name: string): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`项目不存在: ${projectId}`);
    const updated = { ...project, name: name.trim() || project.name, updatedAt: now() };
    this.projects.set(projectId, updated);
    return updated;
  }

  async listProjects(includeDeleted = false): Promise<readonly Project[]> {
    return [...this.projects.values()].filter((project) => includeDeleted || !project.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async loadProjectGraph(projectId: string): Promise<ProjectGraph | null> {
    const project = this.projects.get(projectId);
    if (!project) return null;
    return { project, sourceDocuments: [...this.sources.values()].filter((source) => source.projectId === projectId), screenplayVersions: [...this.versions.values()].filter((version) => version.projectId === projectId), storyBible: [...this.bibles.values()].find((bible) => bible.projectId === projectId) ?? null, scores: [], assets: [], boardPrompts: [], shotGroups: [], generationRecords: [] };
  }

  async softDeleteProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`项目不存在: ${projectId}`);
    this.projects.set(projectId, { ...project, deletedAt: now(), updatedAt: now() });
  }

  async deleteProjectPermanently(projectId: string): Promise<void> {
    if (!this.projects.has(projectId)) throw new Error(`项目不存在: ${projectId}`);
    this.projects.delete(projectId);
    for (const [key, value] of this.sources) if (value.projectId === projectId) this.sources.delete(key);
    for (const [key, value] of this.versions) if (value.projectId === projectId) this.versions.delete(key);
    for (const [key, value] of this.bibles) if (value.projectId === projectId) this.bibles.delete(key);
    const deletedAssetIds = new Set<string>();
    for (const [key, value] of this.assets) if (value.projectId === projectId) { deletedAssetIds.add(value.id); this.assets.delete(key); }
    for (const [key, value] of this.boardPrompts) if (deletedAssetIds.has(value.assetId)) this.boardPrompts.delete(key);
  }

  async restoreProject(projectId: string): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`项目不存在: ${projectId}`);
    const restored = { ...project, deletedAt: null, updatedAt: now() };
    this.projects.set(projectId, restored);
    return restored;
  }

  async saveSourceDocument(document: SourceDocument): Promise<SourceDocument> {
    const project = this.projects.get(document.projectId);
    if (!project) throw new Error(`项目不存在: ${document.projectId}`);
    if (this.sources.has(document.id)) throw new Error('原稿只读，不能覆盖已保存版本');
    this.sources.set(document.id, document);
    this.projects.set(project.id, { ...project, sourceDocumentIds: [...new Set([...project.sourceDocumentIds, document.id])], updatedAt: now() });
    return document;
  }

  async saveVersion(version: ScreenplayVersion): Promise<ScreenplayVersion> {
    const project = this.projects.get(version.projectId);
    if (!project) throw new Error(`项目不存在: ${version.projectId}`);
    if (this.versions.has(version.id)) throw new Error('版本历史不可覆盖，请创建子版本');
    this.versions.set(version.id, version);
    this.projects.set(project.id, { ...project, activeVersionId: version.id, updatedAt: now() });
    return version;
  }

  async saveStoryBible(bible: StoryBible): Promise<StoryBible> {
    const project = this.projects.get(bible.projectId);
    if (!project) throw new Error(`项目不存在: ${bible.projectId}`);
    this.bibles.set(bible.id, bible);
    this.projects.set(project.id, { ...project, storyBibleId: bible.id, updatedAt: now() });
    return bible;
  }
  async loadProjectAssets(projectId: string) { return { assets: [...this.assets.values()].filter((asset) => asset.projectId === projectId), boardPrompts: [...this.boardPrompts.values()].filter((prompt) => this.assets.get(prompt.assetId)?.projectId === projectId) }; }
  async saveProjectAssets(projectId: string, assets: readonly Asset[], boardPrompts: readonly BoardPrompt[]) { assets.forEach((asset) => this.assets.set(asset.id, asset)); boardPrompts.forEach((prompt) => this.boardPrompts.set(prompt.id, prompt)); }
}

export type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
export class TauriProjectRepository implements ProjectRepository {
  constructor(private readonly invoke: TauriInvoker) {}
  createProject(name: string) { return this.invoke<Project>('create_project', { name }); }
  renameProject(id: string, name: string) { return this.invoke<Project>('rename_project', { id, name }); }
  listProjects(includeDeleted = false) { return this.invoke<readonly Project[]>('list_projects', { includeDeleted }); }
  loadProjectGraph(id: string) { return this.invoke<ProjectGraph | null>('load_project_graph', { id }); }
  async softDeleteProject(id: string) { await this.invoke<void>('soft_delete_project', { id }); }
  async deleteProjectPermanently(id: string) { await this.invoke<void>('delete_project_permanently', { id }); }
  restoreProject(id: string) { return this.invoke<Project>('restore_project', { id }); }
  saveSourceDocument(document: SourceDocument) { return this.invoke<SourceDocument>('save_source_document', { document }); }
  async saveVersion(version: ScreenplayVersion): Promise<ScreenplayVersion> {
    // The Rust persistence DTO is deliberately smaller than the rich UI model.
    // Translate bodyMarkdown/sourceVersionId to the wire names it requires and
    // keep returning the original model so the UI retains scenes and metadata.
    await this.invoke('save_version', {
      version: {
        id: version.id,
        projectId: version.projectId,
        sourceDocumentId: version.sourceVersionId ?? null,
        parentVersionId: version.parentVersionId ?? null,
        versionNumber: version.versionNumber,
        title: version.title,
        content: version.bodyMarkdown ?? "",
        status: version.status,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        episodeNumber: version.episodeNumber ?? null,
        entryType: version.entryType ?? null,
        generationContextJson: version.generationContext ? JSON.stringify(version.generationContext) : null,
      },
    });
    return version;
  }
  saveStoryBible(bible: StoryBible) { return this.invoke<StoryBible>('save_story_bible', { bible }); }
  loadProjectAssets(projectId: string) { return this.invoke<{ assets: Asset[]; boardPrompts: BoardPrompt[] }>('load_project_assets', { projectId }); }
  async saveProjectAssets(projectId: string, assets: readonly Asset[], boardPrompts: readonly BoardPrompt[]) { await this.invoke<void>('save_project_assets', { input: { projectId, assets, boardPrompts } }); }
}
