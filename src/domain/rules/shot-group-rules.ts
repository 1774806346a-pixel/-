import type { FourGridCell, ShotGroup, TimedShot } from '../models';

export const SHOT_GROUP_SECTION_ORDER = ['人物信息', '场景信息', '道具与UI信息', '对白锁定', '分镜承接', '风格总纲', 'timed shots', '四宫格剧情图提示词', '视频提示词'] as const;

export function validateTimedShots(shots: readonly TimedShot[]): string[] {
  const errors: string[] = [];
  if (shots.length < 3 || shots.length > 4) errors.push('每组必须包含 3-4 个 timed shots');
  let previousEnd = 0;
  const ids = new Set<string>();
  shots.forEach((shot, index) => {
    if (ids.has(shot.shotId)) errors.push(`shot ID 重复: ${shot.shotId}`);
    ids.add(shot.shotId);
    if (shot.timing.start < 0 || shot.timing.end > 10 || shot.timing.start >= shot.timing.end) errors.push(`${shot.shotId} 时间必须在 0-10 秒且 start < end`);
    if (index > 0 && shot.timing.start < previousEnd) errors.push(`${shot.shotId} 与前一镜头时间重叠`);
    previousEnd = shot.timing.end;
    if (shot.assetRefs.some((ref) => !ref.startsWith('@'))) errors.push(`${shot.shotId} 存在未命名资产引用`);
  });
  return errors;
}

export function validateFourGridAlignment(shots: readonly TimedShot[], cells: readonly FourGridCell[]): string[] {
  const errors: string[] = [];
  if (cells.length !== 4) errors.push('四宫格必须恰好包含 4 个单元格');
  const shotMap = new Map(shots.map((shot) => [shot.shotId, shot]));
  cells.forEach((cell) => {
    const shot = shotMap.get(cell.shotId);
    if (!shot) errors.push(`四宫格引用未注册 shot ID: ${cell.shotId}`);
    if (!cell.sceneName.trim() || !cell.shotSpecification.trim() || !cell.visualDescription.trim() || !cell.imagePrompt.trim() || !cell.colorScript.trim()) errors.push(`${cell.shotId} 四宫格字段不完整`);
    if (shot && !cell.shotSpecification.includes(shot.shotSize)) errors.push(`${cell.shotId} 四宫格镜头规格未与 timed shot 对齐`);
  });
  return errors;
}

export function validateShotGroup(group: Pick<ShotGroup, 'shots' | 'fourGrid' | 'videoPrompt' | 'propUiInfo'>): string[] {
  const errors = [...validateTimedShots(group.shots), ...validateFourGridAlignment(group.shots, group.fourGrid)];
  if (/(?:添加|加入|配上|使用)(?:字幕|BGM|背景音乐)/i.test(group.videoPrompt)) errors.push('视频提示词不得添加字幕或 BGM');
  if (group.shots.some((shot) => /(?:添加|加入|配上|使用)(?:字幕|BGM|背景音乐)/i.test(`${shot.sound}${shot.visualAction}`))) errors.push('镜头描述不得添加字幕或 BGM');
  return errors;
}
