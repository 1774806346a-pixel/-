import { describe, expect, it } from 'vitest';
import { ProjectService } from '../../src/application/services/project-service';
import { InMemoryProjectRepository } from '../../src/infrastructure/project-repository';

describe('project and source workflow', () => {
  it('persists a source document in the project graph without allowing edits', async () => {
    const repository = new InMemoryProjectRepository();
    const service = new ProjectService(repository);
    const project = await service.create('Workflow');
    const source = await service.saveSource({
      id: 'source-1', projectId: project.id, schemaVersion: 1, kind: 'screenplay',
      title: '原稿', body: '第一场\n人物对白', sha256: 'hash-1', wordCount: 8,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    expect((await service.load(project.id))?.sourceDocuments).toEqual([source]);
    await expect(service.saveSource({ ...source, body: '被篡改' })).rejects.toThrow();
  });

  it('keeps projects recoverable after soft delete and restore', async () => {
    const service = new ProjectService(new InMemoryProjectRepository());
    const project = await service.create('Recoverable');
    await service.remove(project.id);
    expect(await service.list()).toEqual([]);
    expect((await service.list(true))[0]?.deletedAt).toBeTruthy();
    await service.restore(project.id);
    expect((await service.list())[0]?.id).toBe(project.id);
  });
});
