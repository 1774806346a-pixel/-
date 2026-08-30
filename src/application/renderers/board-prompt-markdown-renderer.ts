import type { Asset, BoardPrompt } from '../../domain/models';

export function renderBoardPromptMarkdown(prompt: BoardPrompt, asset?: Pick<Asset, 'name' | 'displayName' | 'kind'>): string {
  const title = asset ? `${asset.name} ${asset.displayName}` : prompt.assetId;
  return [`## ${title}`, '', `- 用途：${prompt.purpose}`, `- 风格基线：${prompt.styleBaseline}`, `- 拆分细节：${prompt.decomposition}`, prompt.colorConstraints ? `- 色卡约束：${prompt.colorConstraints}` : '', `- 版式要求：${prompt.layoutRequirements}`, `- 提示词：${prompt.prompt}`, `- 避免：${prompt.avoid}`, prompt.reference ? `- 本地 PNG 参考：${prompt.reference.absolutePath}（${prompt.reference.width}x${prompt.reference.height}，${prompt.reference.sha256}）` : ''].filter(Boolean).join('\n');
}

export function renderBoardPromptsMarkdown(prompts: readonly BoardPrompt[], assets: readonly Asset[] = []): string {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return prompts.map((prompt) => renderBoardPromptMarkdown(prompt, byId.get(prompt.assetId))).join('\n\n');
}
