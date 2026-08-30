import { describe, expect, it } from 'vitest';
import { compareProtectedText } from '../../src/domain/rules/source-protection';

describe('source protection', () => {
  it('allows contiguous splitting but rejects rewriting', () => {
    expect(compareProtectedText(['你终于来了。'], ['你终于', '来了。']).valid).toBe(true);
    const changed = compareProtectedText(['你终于来了。'], ['你终于到了。']);
    expect(changed.valid).toBe(false);
    expect(changed.changed).toContain('你终于到了。');
  });

  it('rejects deletion, merge, and reordering', () => {
    expect(compareProtectedText(['甲', '乙'], ['甲']).missing).toEqual(['乙']);
    expect(compareProtectedText(['甲', '乙'], ['甲乙']).merged).toEqual(['甲乙']);
    expect(compareProtectedText(['甲', '乙'], ['乙', '甲']).valid).toBe(false);
  });
});
