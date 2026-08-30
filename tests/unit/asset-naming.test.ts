import { describe, expect, it } from 'vitest';
import { assetNameFor, findDanglingAssetReferences, validateAssetName } from '../../src/domain/rules/asset-naming';

describe('asset naming rules', () => {
  it('enforces kind-specific @ prefixes and normalizes display names', () => {
    expect(validateAssetName('character', '@人物林安').valid).toBe(true);
    expect(validateAssetName('scene', '@人物仓库').valid).toBe(false);
    expect(assetNameFor('prop', ' 铁盒 ')).toBe('@道具铁盒');
  });

  it('finds dangling references while ignoring deleted assets', () => {
    const document = {
      assets: [{ name: '@道具铁盒', deletedAt: null }, { name: '@场景仓库', deletedAt: 'now' }],
      shots: [{ assetRefs: ['@道具铁盒', '@场景仓库', '@UI警报'] }],
    };
    expect(findDanglingAssetReferences(document).map((item) => item.reference)).toEqual(['@场景仓库', '@UI警报']);
  });
});
