import { describe, expect, it } from 'vitest';
import { buildBoardPrompt, validateBoardPrompt } from '../../src/domain/rules/board-prompt-rules';
import type { Asset } from '../../src/domain/models';

const asset: Asset = { id: 'a-1', projectId: 'p-1', schemaVersion: 1, kind: 'character', name: '@人物林安', displayName: '林安', description: '调查员', firstAppearance: { episode: 1, scene: 'scene-1' }, appearances: [], aliases: [], locked: true };

describe('board prompt rules', () => {
  it('creates a self-contained character board prompt', () => {
    const prompt = buildBoardPrompt(asset);
    expect(prompt.prompt).toContain('正面、侧面、背面三视图');
    expect(prompt.prompt).toContain('中文标签');
    expect(validateBoardPrompt(prompt)).toEqual([]);
  });
});
