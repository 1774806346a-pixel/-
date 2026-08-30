import { describe, expect, it } from 'vitest';
import { buildShotGroup } from '../../src/application/services/shot-group-service';
import { renderShotGroupMarkdown } from '../../src/application/renderers/shot-group-markdown-renderer';
import type { ScreenplayScene } from '../../src/domain/models';

const scene: ScreenplayScene = { id: 'scene-1', sequence: 1, header: { location: '仓库', timeOfDay: 'night', setting: 'interior' }, characters: ['林安'], actions: [{ type: 'action', subject: '林安', description: '林安抬头' }], dialogues: [{ type: 'dialogue', speaker: '林安', text: '谁在那里？' }] };

describe('shot group generation', () => {
  it('generates a ten-second group with aligned four-grid and copyable markdown', () => {
    const group = buildShotGroup(scene, { projectId: 'p-1' });
    expect(group.durationSeconds).toBe(10);
    expect(group.shots.length).toBeGreaterThanOrEqual(3);
    expect(group.shots.length).toBeLessThanOrEqual(4);
    expect(group.fourGrid).toHaveLength(4);
    expect(group.fourGrid.every((cell) => group.shots.some((shot) => shot.shotId === cell.shotId))).toBe(true);
    expect(group.videoPrompt).toMatch(/无字幕.*无 BGM/);
    expect(renderShotGroupMarkdown(group)).toContain('本组四宫格剧情图提示词');
  });

  it('rejects invalid custom shot timing and four-grid IDs', () => {
    expect(() => buildShotGroup(scene, { projectId: 'p-1', shots: [{ shotId: 's1', timing: { start: 0, end: 10 }, transition: 'cut', shotSize: '中景', cameraMovement: '推进', visualAction: '动作', sound: '环境声', dialogueOrNarration: '', assetRefs: [] }] })).toThrow();
  });

  it('blocks a group with an unregistered named asset when an asset table is supplied', () => {
    expect(() => buildShotGroup(scene, {
      projectId: 'p-1',
      assets: [],
      videoPrompt: '@道具铁盒被打开，无字幕，无 BGM。',
    })).toThrow(/未注册资产引用/);
  });
});
