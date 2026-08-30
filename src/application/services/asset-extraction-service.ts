import type { Asset, AssetKind, ScreenplayVersion } from '../../domain/models';
import { assetNameFor, extractAssetReferences } from '../../domain/rules/asset-naming';

export interface AssetExtractionResult {
  assets: Asset[];
  references: string[];
  warnings: string[];
}

export interface ProjectAssetExtractionResult extends AssetExtractionResult {
  versionsProcessed: number;
}

const stableId = (projectId: string, kind: AssetKind, name: string) => `${projectId}:asset:${kind}:${name}`;
const appearance = (episode: number, scene: string, shot?: string) => ({ episode, scene, ...(shot ? { shot } : {}) });

function upsert(map: Map<string, Asset>, input: Omit<Asset, 'id' | 'schemaVersion' | 'appearances' | 'aliases' | 'locked'> & { appearances?: Asset['appearances']; aliases?: string[]; locked?: boolean }): Asset {
  const key = `${input.kind}:${input.name}`;
  const existing = map.get(key);
  if (existing) {
    existing.appearances = [...existing.appearances, ...(input.appearances ?? [])].filter((item, index, all) => index === all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)));
    return existing;
  }
  const { appearances, aliases, locked, ...base } = input;
  const created: Asset = { ...base, id: stableId(input.projectId, input.kind, input.name), schemaVersion: 1, appearances: appearances ?? [input.firstAppearance], aliases: aliases ?? [], locked: locked ?? false };
  map.set(key, created);
  return created;
}

function kindForReference(reference: string): AssetKind {
  if (reference.startsWith('@人物')) return 'character';
  if (reference.startsWith('@场景')) return 'scene';
  if (reference.startsWith('@UI')) return 'ui';
  return 'prop';
}

/** Extracts only production-visible, reusable assets from a confirmed screenplay. */
export function extractAssets(screenplay: ScreenplayVersion, episode = 1): AssetExtractionResult {
  if (screenplay.status !== 'confirmed') throw new Error('只有已确认的剧本版本才能提取生产资产');
  const map = new Map<string, Asset>();
  screenplay.characters.forEach((character) => {
    const name = assetNameFor('character', character.name);
    upsert(map, { projectId: screenplay.projectId, kind: 'character', name, displayName: character.name, description: `${character.identity}；${character.appearance}；${character.personality}`, firstAppearance: appearance(episode, screenplay.scenes[0]?.id ?? 'unknown'), locked: Boolean(character.locked ?? true) });
  });
  const allReferences = extractAssetReferences(screenplay);
  screenplay.scenes.forEach((scene) => {
    const sceneName = assetNameFor('scene', scene.header.location);
    upsert(map, { projectId: screenplay.projectId, kind: 'scene', name: sceneName, displayName: scene.header.location, description: `${scene.header.setting}，${scene.header.timeOfDay}`, firstAppearance: appearance(episode, scene.id), appearances: [appearance(episode, scene.id)], locked: true });
    scene.characters.forEach((characterRef) => {
      const character = screenplay.characters.find((candidate) => candidate.id === characterRef || candidate.name === characterRef);
      if (character) {
        const asset = map.get(`character:${assetNameFor('character', character.name)}`);
        if (asset) asset.appearances.push(appearance(episode, scene.id));
      }
    });
    const refs = extractAssetReferences(scene);
    refs.forEach((reference) => {
      const kind = kindForReference(reference);
      upsert(map, { projectId: screenplay.projectId, kind, name: reference, displayName: reference.replace(/^@(人物|场景|道具|UI)/, ''), description: `剧本中使用的${kind === 'ui' ? '界面' : kind === 'prop' ? '道具' : kind}`, firstAppearance: appearance(episode, scene.id), appearances: [appearance(episode, scene.id)] });
    });
    scene.actions.filter((action) => action.visualTag === 'screen').forEach((action) => {
      const name = assetNameFor('ui', action.subject);
      upsert(map, { projectId: screenplay.projectId, kind: 'ui', name, displayName: action.subject, description: action.description, firstAppearance: appearance(episode, scene.id), appearances: [appearance(episode, scene.id)] });
    });
  });
  const assets = [...map.values()].map((asset) => ({ ...asset, appearances: asset.appearances.filter((item, index, all) => index === all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item))) }));
  return { assets, references: allReferences, warnings: [] };
}

/** Merges reusable scene, character, and prop assets across all saved episodes. */
export function extractProjectAssets(screenplays: readonly ScreenplayVersion[]): ProjectAssetExtractionResult {
  const merged = new Map<string, Asset>();
  const references = new Set<string>();
  const warnings: string[] = [];
  let versionsProcessed = 0;
  for (const screenplay of screenplays) {
    try {
      // Saved episodic versions are drafts until confirmed. Extraction is read-only,
      // so reuse the existing parser without changing the persisted status.
      const result = extractAssets(screenplay.status === 'confirmed' ? screenplay : { ...screenplay, status: 'confirmed' });
      versionsProcessed += 1;
      result.references.forEach((reference) => references.add(reference));
      warnings.push(...result.warnings);
      for (const asset of result.assets) {
        if (asset.kind === 'ui') continue;
        const key = `${asset.kind}:${asset.name}`;
        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, { ...asset, appearances: [...asset.appearances] });
          continue;
        }
        existing.appearances = [...existing.appearances, ...asset.appearances]
          .filter((item, index, all) => index === all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item)));
        existing.locked = existing.locked || asset.locked;
        if (existing.description.length < asset.description.length) existing.description = asset.description;
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }
  return {
    assets: [...merged.values()].map((asset) => ({
      ...asset,
      appearances: asset.appearances.filter((item, index, all) => index === all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(item))),
    })),
    references: [...references],
    warnings,
    versionsProcessed,
  };
}

export class AssetExtractionService {
  extract(screenplay: ScreenplayVersion): AssetExtractionResult { return extractAssets(screenplay); }
  extractProject(screenplays: readonly ScreenplayVersion[]): ProjectAssetExtractionResult { return extractProjectAssets(screenplays); }
}
