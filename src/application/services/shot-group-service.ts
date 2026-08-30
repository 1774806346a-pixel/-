import type { Asset, ScreenplayScene, ShotGroup, TimedShot, FourGridCell } from '../../domain/models';
import { findDanglingAssetReferences } from '../../domain/rules/asset-naming';
import { validateShotGroup } from '../../domain/rules/shot-group-rules';

export interface ShotGroupOptions {
  id?: string;
  projectId: string;
  episode?: number;
  characterInfo?: string;
  sceneInfo?: string;
  propUiInfo?: string;
  dialogueLock?: string;
  continuity?: string;
  styleGuide?: string;
  shots?: TimedShot[];
  fourGrid?: FourGridCell[];
  videoPrompt?: string;
  /** When supplied, every named @ asset used by the group must be registered here. */
  assets?: readonly Asset[];
}

const now = () => new Date().toISOString();
const defaultShots = (scene: ScreenplayScene): TimedShot[] => {
  const descriptions = scene.actions.map((action) => action.description);
  const dialogues = scene.dialogues.map((line) => `${line.speaker}：${line.text}`);
  const count = Math.min(4, Math.max(3, descriptions.length + dialogues.length || 3));
  return Array.from({ length: count }, (_, index) => {
    const start = Number((index * (10 / count)).toFixed(2));
    const end = Number(((index + 1) * (10 / count)).toFixed(2));
    return { shotId: `${scene.id}-${String(index + 1).padStart(4, '0')}`, timing: { start, end }, transition: index ? 'cut' : 'fade-in', shotSize: index === 0 ? '大远景' : index === count - 1 ? '特写' : '中近景', cameraMovement: index === 0 ? '平视' : '缓慢推进', visualAction: descriptions[index] ?? dialogues[index] ?? `${scene.header.location}中的连续动作`, sound: '环境声、呼吸声与衣料摩擦', dialogueOrNarration: dialogues[index] ?? '', assetRefs: [] };
  });
};

const defaultGrid = (shots: readonly TimedShot[], scene: ScreenplayScene): FourGridCell[] => {
  const cells = shots.map((shot) => ({ shotId: shot.shotId, sceneName: scene.header.location, shotSpecification: shot.shotSize, visualDescription: shot.visualAction, imagePrompt: `高质量中国仙侠 3D 动画，${scene.header.location}，${shot.shotSize}，${shot.cameraMovement}，${shot.visualAction}，稳定角色身份，无字幕`, colorScript: '冷青主色，低饱和，高对比边缘光' }));
  while (cells.length < 4) {
    const source = cells[cells.length - 1] ?? { shotId: `${scene.id}-0001`, sceneName: scene.header.location, shotSpecification: '中景', visualDescription: '连续动作', imagePrompt: '高质量中国仙侠 3D 动画画面，无字幕', colorScript: '冷青主色' };
    cells.push({ ...source, shotId: source.shotId });
  }
  return cells.slice(0, 4);
};

export function buildShotGroup(scene: ScreenplayScene, options: ShotGroupOptions): ShotGroup {
  const shots = options.shots ?? defaultShots(scene);
  const fourGrid = options.fourGrid ?? defaultGrid(shots, scene);
  const characterInfo = options.characterInfo ?? (scene.characters.join('、') || '未命名角色');
  const dialogueLock = options.dialogueLock ?? (scene.dialogues.map((line) => `${line.speaker}：${line.text}`).join('\n') || '无对白');
  const videoPrompt = options.videoPrompt ?? `@场景${scene.header.location}，${shots.map((shot) => shot.visualAction).join('；')}。${groupSafeDialogue(shots)}，无字幕，无 BGM，保持角色身份和连续性。`;
  const group: ShotGroup = { id: options.id ?? `${options.projectId}:shot-group:${scene.id}`, projectId: options.projectId, schemaVersion: 1, episode: options.episode ?? 1, sceneId: scene.id, durationSeconds: 10, characterInfo, sceneInfo: options.sceneInfo ?? `${scene.header.location}，${scene.header.timeOfDay}`, propUiInfo: options.propUiInfo ?? '（无）', dialogueLock, continuity: options.continuity ?? '承接上一镜头结尾画面，保持角色、服装、场景和道具连续', styleGuide: options.styleGuide ?? '高质量中国仙侠 3D 动画；稳定镜头运动；无字幕；无 BGM；无脸部变形、闪烁或重影', shots, fourGrid, videoPrompt, createdAt: now(), updatedAt: now() };
  const errors = validateShotGroup(group);
  if (options.assets) {
    const dangling = findDanglingAssetReferences({ assets: options.assets, group });
    errors.push(...dangling.map((item) => `未注册资产引用 ${item.reference}（${item.path}）`));
  }
  if (errors.length) throw new Error(`镜头组校验失败：${errors.join('；')}`);
  return group;
}

function groupSafeDialogue(shots: readonly TimedShot[]): string {
  return shots.map((shot) => shot.dialogueOrNarration).filter(Boolean).join('；') || '无对白';
}

export class ShotGroupService {
  generate(scene: ScreenplayScene, options: ShotGroupOptions): ShotGroup { return buildShotGroup(scene, options); }
}
