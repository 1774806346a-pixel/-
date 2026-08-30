import type { ShotGroup } from '../../domain/models';

export function renderShotGroupMarkdown(group: ShotGroup): string {
  const lines = [`## 第${group.episode}集 / ${group.sceneId}镜头组`, '', `【人物信息】${group.characterInfo}`, `【场景信息】${group.sceneInfo}`, `【道具与UI信息】${group.propUiInfo}`, `【对白锁定】${group.dialogueLock}`, `【分镜承接】${group.continuity}`, `【风格总纲】${group.styleGuide}`, '', '### Timed shots'];
  group.shots.forEach((shot) => {
    lines.push(`#### ${shot.shotId}（${shot.timing.start}-${shot.timing.end}秒）`, `转场：${shot.transition}`, `镜头：${shot.shotSize}，${shot.cameraMovement}`, `主体动作：${shot.visualAction}`, `音效：${shot.sound}`, `旁白/对白：${shot.dialogueOrNarration || '无'}`, `资产：${shot.assetRefs.join('、') || '无'}`, '');
  });
  lines.push('### 本组四宫格剧情图提示词');
  group.fourGrid.forEach((cell) => lines.push(`#### ${cell.shotId}`, `场景：${cell.sceneName}`, `镜头规格：${cell.shotSpecification}`, `画面描述：${cell.visualDescription}`, `图片提示词：${cell.imagePrompt}`, `色调脚本：${cell.colorScript}`, ''));
  lines.push('### 本组视频提示词', group.videoPrompt);
  return lines.join('\n');
}

export function renderShotGroupsMarkdown(groups: readonly ShotGroup[]): string { return groups.map(renderShotGroupMarkdown).join('\n\n'); }
