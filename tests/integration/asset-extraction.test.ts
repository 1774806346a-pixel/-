import { describe, expect, it } from 'vitest';
import { extractStoryBible } from '../../src/application/services/story-bible-service';
import { extractAssets, extractProjectAssets } from '../../src/application/services/asset-extraction-service';
import { generateBoardPrompts } from '../../src/application/services/board-prompt-service';
import { analyzeProjectAssets } from '../../src/application/services/model-asset-analysis-service';
import type { GenerationEvent, GenerationRequest, ModelAdapter } from '../../src/application/model/model-adapter';
import type { ScreenplayVersion } from '../../src/domain/models';

const screenplay = (status: ScreenplayVersion['status'] = 'confirmed'): ScreenplayVersion => ({
  id: 'version-1', projectId: 'project-1', schemaVersion: 1, versionNumber: 1, title: '测试', sourceVersionId: null, parentVersionId: null, status,
  metadata: { title: '测试', genre: '短剧', elements: ['悬疑'], episodeCount: 1, episodeDurationSeconds: 90, oneLineSynopsis: '林安打开铁盒发现警报', comparableWorks: [] },
  characters: [{ id: 'char-1', name: '林安', identity: '调查员', appearance: '短发', personality: '谨慎', locked: true }],
  scenes: [{ id: 'scene-1', sequence: 1, header: { location: '仓库', timeOfDay: 'night', setting: 'interior' }, characters: ['char-1'], actions: [{ type: 'action', subject: '警报面板', description: '警报面板亮起', visualTag: 'screen' }], dialogues: [{ type: 'dialogue', speaker: '林安', text: '这不可能。' }] }],
  adaptationHandling: { deleted: [], rewritten: [], compressed: [], foreshadowing: [], pendingConfirmation: [] },
  qualitySelfCheck: { sceneCount: 1, actionDescriptionRate: 1, dialogueEmotionRate: 0, wordCount: 20, suspenseStrength: 80, endingHook: '警报响起' },
  createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
});

describe('asset extraction and board generation', () => {
  it('sends all episodes to the model and preserves the existing asset library', async () => {
    let request: GenerationRequest | undefined;
    const adapter: ModelAdapter = {
      provider: 'ollama',
      modelName: 'asset-test',
      async testConnection() { return { ok: true, provider: 'ollama', message: 'ok' }; },
      async listModels() { return []; },
      async *generate(input: GenerationRequest): AsyncIterable<GenerationEvent> {
        request = input;
        yield { type: 'completed', text: JSON.stringify({ assets: [{ kind: 'prop', displayName: '鎵佸瓙', description: '鍙戝厜鐨勯噾灞炴墜鎵�', aliases: [], firstAppearance: { episode: 2, scene: '2-1' }, appearances: [], worthProducing: true }] }) };
      },
    };
    const first = { ...screenplay(), episodeNumber: 1, bodyMarkdown: '绗竴闆嗭細浠撳簱鍜岃鎶ュ櫒' };
    const second = { ...screenplay(), episodeNumber: 2, versionNumber: 2, bodyMarkdown: '绗簩闆嗭細鎵佸瓙鍑虹幇' };
    const oldAsset = extractProjectAssets([first]).assets.find((asset) => asset.kind === 'scene');
    expect(oldAsset).toBeTruthy();
    const result = await analyzeProjectAssets(adapter, [first, second], [oldAsset!]);
    expect(request?.systemPrompt).toContain('绗竴闆嗭細浠撳簱');
    expect(request?.systemPrompt).toContain('绗簩闆嗭細鎵佸瓙');
    expect(result.assets.some((asset) => asset.id === oldAsset!.id)).toBe(true);
    expect(result.assets.some((asset) => asset.displayName === '鎵佸瓙')).toBe(true);
  });

  it('falls back without clearing assets when model output is invalid', async () => {
    const adapter: ModelAdapter = {
      provider: 'ollama', modelName: 'asset-test',
      async testConnection() { return { ok: true, provider: 'ollama', message: 'ok' }; },
      async listModels() { return []; },
      async *generate(): AsyncIterable<GenerationEvent> { yield { type: 'completed', text: '{invalid' }; },
    };
    const existing = extractProjectAssets([screenplay()]).assets;
    const result = await analyzeProjectAssets(adapter, [screenplay()], existing);
    expect(result.usedModel).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.assets.length).toBeGreaterThan(0);
  });

  it('merges assets across episodes into scene, character, and prop groups', () => {
    const first = screenplay();
    const second = { ...screenplay(), episodeNumber: 2, scenes: [{ ...screenplay().scenes[0], id: 'scene-2' }] };
    const result = extractProjectAssets([first, second]);
    expect(result.versionsProcessed).toBe(2);
    expect(result.assets.every((asset) => ['scene', 'character', 'prop'].includes(asset.kind))).toBe(true);
    expect(result.assets.find((asset) => asset.kind === 'scene')?.appearances.length).toBe(2);
  });
  it('requires a confirmed screenplay and extracts story bible plus assets', () => {
    expect(() => extractStoryBible(screenplay('draft'))).toThrow();
    const bible = extractStoryBible(screenplay());
    expect(bible.characters[0]?.locked).toBe(true);
    const result = extractAssets(screenplay());
    expect(result.assets.map((asset) => asset.kind)).toEqual(expect.arrayContaining(['character', 'scene', 'ui']));
    expect(result.assets.every((asset) => asset.name.startsWith('@'))).toBe(true);
    const boards = generateBoardPrompts(result.assets);
    expect(boards.errors).toEqual([]);
    expect(boards.prompts.every((prompt) => prompt.decomposition && prompt.layoutRequirements && prompt.prompt && prompt.avoid)).toBe(true);
  });
});
