import type { ScreenplayVersion } from "../../domain/models";

const voiceLabel = (line: { voiceType?: string; speaker: string }) =>
  line.voiceType && line.voiceType !== "dialogue" ? `${line.voiceType} ${line.speaker}` : line.speaker;

export function renderScreenplayMarkdown(version: ScreenplayVersion): string {
  const episode = version.episodeNumber ?? 1;
  const lines: string[] = ["【本次改编】", `- 原文版本：${version.sourceVersionId ?? "未指定"}`, `- 改编集数：${episode}`, "---", "【剧本信息】", `- 题材：${version.metadata.genre}`, `- 单集时长：${version.metadata.episodeDurationSeconds} 秒`, `- 一句话简介：${version.metadata.oneLineSynopsis}`, "【主要人设】"];
  for (const character of version.characters) lines.push(`- ${character.name}：${character.age ?? ""} ${character.identity}；${character.appearance}；${character.personality}`.trim());
  lines.push("【故事梗概】", "- 由原始素材和主体大纲约束生成。", "---", `## 第${episode}集`);
  for (const scene of version.scenes) {
    const time = scene.header.timeOfDay === "day" ? "日" : scene.header.timeOfDay === "night" ? "夜" : scene.header.timeOfDay;
    const setting = scene.header.setting === "interior" ? "内" : scene.header.setting === "exterior" ? "外" : scene.header.setting;
    lines.push(`### ${episode}-${scene.sequence}`, `**场：${scene.header.location}・${time}・${setting}**`, `**人：${scene.characters.join("、")}**`);
    for (const action of scene.actions) lines.push(`△ ${action.subject}${action.description}`);
    for (const dialogue of scene.dialogues) lines.push(`${voiceLabel(dialogue)}（${dialogue.emotion ?? "平静"}）：${dialogue.text}`);
    if (scene.card) lines.push(`【${scene.card}】`);
  }
  lines.push("", `【第${episode}集 改编处理】`);
  for (const [label, values] of [["删除", version.adaptationHandling.deleted], ["改写", version.adaptationHandling.rewritten], ["压缩", version.adaptationHandling.compressed], ["伏笔", version.adaptationHandling.foreshadowing]] as const) lines.push(`- ${label}：${values.join("、") || "无"}`);
  lines.push(`【第${episode}集 质量自检】`, `- 场景数量：${version.qualitySelfCheck.sceneCount}`, `- 动作描述率：${Math.round(version.qualitySelfCheck.actionDescriptionRate * 100)}%`, `- 对白情绪标注率：${Math.round(version.qualitySelfCheck.dialogueEmotionRate * 100)}%`, `- 字数：${version.qualitySelfCheck.wordCount}`, `- 悬念强度：${version.qualitySelfCheck.suspenseStrength}`, `- 结尾钩子：${version.qualitySelfCheck.endingHook}`);
  return lines.join("\n");
}
