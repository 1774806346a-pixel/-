import { describe, expect, it } from 'vitest';
import { ProjectService } from '../../src/application/services/project-service';
import { InMemoryProjectRepository } from '../../src/infrastructure/project-repository';
import type { Asset, BoardPrompt } from '../../src/domain/models';

describe('project lifecycle persistence contract', () => {
  it('creates, renames, soft deletes and restores a project graph', async () => {
    const service = new ProjectService(new InMemoryProjectRepository());
    const project = await service.create('  测试项目  ');
    expect(project.name).toBe('测试项目');
    expect((await service.list())).toHaveLength(1);
    const renamed = await service.rename(project.id, '新名称');
    expect(renamed.name).toBe('新名称');
    await service.remove(project.id);
    expect(await service.list()).toHaveLength(0);
    expect(await service.list(true)).toHaveLength(1);
    const restored = await service.restore(project.id);
    expect(restored.deletedAt).toBeNull();
    expect((await service.load(project.id))?.project.id).toBe(project.id);
  });

  it('permanently deletes the project and all child records', async () => {
    const repository = new InMemoryProjectRepository();
    const service = new ProjectService(repository);
    const project = await service.create('Purge me');
    await service.saveSource({ id: 'purge-source', projectId: project.id, schemaVersion: 1, kind: 'idea', title: 'source', body: 'content', sha256: 'hash', wordCount: 7, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await service.deletePermanently(project.id);
    expect(await service.list(true)).toEqual([]);
    expect(await service.load(project.id)).toBeNull();
  });

  it('persists and reloads project assets and board prompts', async () => {
    const repository = new InMemoryProjectRepository();
    const service = new ProjectService(repository);
    const project = await service.create('Assets');
    const asset: Asset = { id: 'asset-1', projectId: project.id, schemaVersion: 1, kind: 'character', name: '@character:linan', displayName: '林安', description: '调查员', firstAppearance: { episode: 1, scene: '1-1' }, appearances: [], aliases: [], locked: false };
    const prompt: BoardPrompt = { id: 'prompt-1', assetId: asset.id, schemaVersion: 1, purpose: '角色母板', styleBaseline: '写实', decomposition: '正侧背三视图', layoutRequirements: '白底分栏', prompt: '角色资产板', avoid: '模糊' };
    await service.saveProjectAssets(project.id, [asset], [prompt]);
    const loaded = await service.loadProjectAssets(project.id);
    expect(loaded.assets).toEqual([asset]);
    expect(loaded.boardPrompts).toEqual([prompt]);
  });
});
