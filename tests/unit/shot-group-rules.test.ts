import { describe, expect, it } from 'vitest';
import { validateFourGridAlignment, validateTimedShots } from '../../src/domain/rules/shot-group-rules';
import type { FourGridCell, TimedShot } from '../../src/domain/models';

const shot = (shotId: string, start: number, end: number): TimedShot => ({ shotId, timing: { start, end }, transition: 'cut', shotSize: '中景', cameraMovement: '推进', visualAction: '角色抬头', sound: '呼吸声', dialogueOrNarration: '', assetRefs: ['@人物林安'] });
const cell = (shotId: string): FourGridCell => ({ shotId, sceneName: '@场景仓库', shotSpecification: '中景', visualDescription: '角色抬头', imagePrompt: '中国仙侠3D动画', colorScript: '冷青' });

describe('shot group rules', () => {
  it('rejects overlapping or out-of-range timed shots', () => {
    expect(validateTimedShots([shot('s1', 0, 4), shot('s2', 3, 8), shot('s3', 8, 11)])).toEqual(expect.arrayContaining([expect.stringContaining('重叠'), expect.stringContaining('0-10')]));
  });

  it('requires four-grid cells to map to registered shot IDs', () => {
    expect(validateFourGridAlignment([shot('s1', 0, 3), shot('s2', 3, 6), shot('s3', 6, 8)], [cell('s1'), cell('s2'), cell('s3'), cell('missing')])).toEqual(expect.arrayContaining([expect.stringContaining('未注册')]));
  });
});
