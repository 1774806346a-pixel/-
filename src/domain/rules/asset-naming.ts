import type { Asset, AssetKind } from '../models';

export const ASSET_PREFIX: Record<AssetKind, string> = {
  character: '@人物',
  scene: '@场景',
  prop: '@道具',
  ui: '@UI',
};

export interface AssetNameValidation {
  valid: boolean;
  kind: AssetKind;
  name: string;
  expectedPrefix: string;
  errors: string[];
}

export interface DanglingAssetReference {
  reference: string;
  kind: AssetKind | 'unknown';
  path: string;
  index?: number;
}

const refPattern = /@(人物|场景|道具|UI)[^@\s，。！？、；：:()（）[\]{}"“”'‘’]+/g;
const prefixToKind: Record<string, AssetKind> = {
  '@人物': 'character',
  '@场景': 'scene',
  '@道具': 'prop',
  '@UI': 'ui',
};

export function validateAssetName(kind: AssetKind, name: string): AssetNameValidation {
  const expectedPrefix = ASSET_PREFIX[kind];
  const errors: string[] = [];
  const normalized = name.trim();
  if (!normalized) errors.push('资产名称不能为空');
  if (!normalized.startsWith(expectedPrefix)) errors.push(`资产名称必须以 ${expectedPrefix} 开头`);
  if (normalized.includes('@', 1)) errors.push('资产名称只能包含一个 @ 前缀');
  if (/\s/.test(normalized)) errors.push('资产名称不能包含空格');
  if (normalized.length <= expectedPrefix.length) errors.push('资产名称必须包含可识别的名称部分');
  return { valid: errors.length === 0, kind, name: normalized, expectedPrefix, errors };
}

export function assetNameFor(kind: AssetKind, displayName: string): string {
  const clean = displayName.trim().replace(/^@(人物|场景|道具|UI)/, '').replace(/\s+/g, '');
  return `${ASSET_PREFIX[kind]}${clean || '未命名'}`;
}

export function assetKindFromName(name: string): AssetKind | 'unknown' {
  for (const [prefix, kind] of Object.entries(prefixToKind)) {
    if (name.startsWith(prefix)) return kind;
  }
  return 'unknown';
}

export function extractAssetReferences(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (current: unknown): void => {
    if (typeof current === 'string') {
      for (const match of current.matchAll(refPattern)) found.add(match[0]);
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current && typeof current === 'object') {
      Object.values(current).forEach(visit);
    }
  };
  visit(value);
  return [...found];
}

/** Finds named @ references that do not have a corresponding active asset. */
export function findDanglingAssetReferences(document: unknown): DanglingAssetReference[] {
  const assets = Array.isArray((document as { assets?: unknown })?.assets)
    ? ((document as { assets: Asset[] }).assets ?? [])
    : [];
  const known = new Set(assets.filter((asset) => !asset.deletedAt).map((asset) => asset.name));
  const dangling: DanglingAssetReference[] = [];
  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(refPattern)) {
        const reference = match[0];
        if (!known.has(reference)) dangling.push({ reference, kind: assetKindFromName(reference), path, index: match.index });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
        if (key !== 'assets') visit(item, path ? `${path}.${key}` : key);
      });
    }
  };
  visit(document, '$');
  return dangling;
}

export function validateAssetCollection(assets: readonly Asset[]): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  for (const asset of assets) {
    const validation = validateAssetName(asset.kind, asset.name);
    if (!validation.valid) errors.push(`${asset.id}: ${validation.errors.join('；')}`);
    if (names.has(asset.name)) errors.push(`重复资产名称: ${asset.name}`);
    names.add(asset.name);
  }
  return errors;
}
