import type { Asset, BoardPrompt } from '../models';

export const BOARD_REQUIRED_FIELDS = ['purpose', 'styleBaseline', 'decomposition', 'layoutRequirements', 'prompt', 'avoid'] as const;

const boardTypeGuidance: Record<Asset['kind'], { decomposition: string; layout: string }> = {
  character: { decomposition: '主视觉立绘；正面、侧面、背面三视图；表情组；服装分层；材质近景；配饰与固定道具', layout: '16:9 横版生产角色板：左侧英雄立绘，中央三视图，右侧表情/服装/材质/配饰分格，中文标签清晰' },
  scene: { decomposition: '主场景英雄视图；平面/俯视布局；多角度视图；氛围研究；镜头路线；关键材质与道具', layout: '16:9 横版场景板：主视图占比最大，辅以布局、角度、色卡、镜头路线和氛围分格' },
  prop: { decomposition: '正面、侧面、背面三视图；开合或启用状态；结构拆解；材质细节；文字位置规范', layout: '16:9 横版道具板：中心正交三视图，周围排列状态、拆解、材质和标签分格' },
  ui: { decomposition: '组件网格；弹窗、信息面板、按钮和状态；可读中文示例；字号与层级规范', layout: '16:9 横版 UI 板：组件网格与状态分格，所有示例文字为可读中文，不出现随机字符' },
};

export interface BoardPromptOptions {
  styleBaseline?: string;
  colorConstraints?: string;
  reference?: BoardPrompt['reference'];
}

export function validateBoardPrompt(prompt: Partial<BoardPrompt>): string[] {
  const errors: string[] = [];
  for (const field of BOARD_REQUIRED_FIELDS) if (!String(prompt[field] ?? '').trim()) errors.push(`缺少资产板字段: ${field}`);
  if (!prompt.assetId) errors.push('资产板必须关联 assetId');
  if (prompt.reference && (!prompt.reference.absolutePath || !Number.isInteger(prompt.reference.width) || !Number.isInteger(prompt.reference.height) || !prompt.reference.sha256)) errors.push('本地 PNG 参考必须包含绝对路径、尺寸和 hash');
  return errors;
}

export function buildBoardPrompt(asset: Asset, options: BoardPromptOptions = {}): BoardPrompt {
  const guidance = boardTypeGuidance[asset.kind];
  const styleBaseline = options.styleBaseline ?? '高质量中国仙侠 3D 动画，非真人实拍，稳定角色身份，16:9、2K、中文标签';
  const colorConstraints = options.colorConstraints ?? (asset.kind === 'scene' ? '主色、辅助色、点缀色、饱和度、对比度、光线类型保持统一，禁止偏色' : undefined);
  const purpose = `${asset.displayName}的${asset.kind === 'character' ? '角色' : asset.kind === 'scene' ? '场景' : asset.kind === 'prop' ? '道具' : '界面'}生产资产板`;
  const prompt = `${styleBaseline}；${guidance.layout}；主体为 ${asset.name}（${asset.description}）。${guidance.decomposition}；所有中文标签必须清晰可读，仅允许资产名称、视图名称、状态名称和材质标注，不生成随机字母或额外文字。`;
  return { id: `${asset.id}:board`, assetId: asset.id, schemaVersion: 1, purpose, styleBaseline, decomposition: guidance.decomposition, colorConstraints, layoutRequirements: guidance.layout, prompt, avoid: '避免真人照片、现代污染、随机文字、乱码、重复姿势、结构缺失、脸部变形、闪烁和低清晰度', reference: options.reference };
}
