import { describe, expect, it } from 'vitest';
import { generateBoardPrompts } from '../../src/application/services/board-prompt-service';
import { renderBoardPromptsMarkdown } from '../../src/application/renderers/board-prompt-markdown-renderer';
import type { Asset } from '../../src/domain/models';

const asset: Asset = { id: 'a-1', projectId: 'p-1', schemaVersion: 1, kind: 'prop', name: '@道具铁盒', displayName: '铁盒', description: '旧铁盒', firstAppearance: { episode: 1, scene: 'scene-1' }, appearances: [], aliases: [], locked: false };

describe('board prompt generation', () => {
  it('renders a directly copyable standalone block', () => {
    const result = generateBoardPrompts([asset]);
    expect(result.prompts).toHaveLength(1);
    const markdown = renderBoardPromptsMarkdown(result.prompts, [asset]);
    expect(markdown).toContain('拆分细节');
    expect(markdown).toContain('@道具铁盒');
    expect(markdown).toContain('正面、侧面、背面');
  });
});
