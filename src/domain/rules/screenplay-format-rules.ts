import type { ScreenplayVersion } from "../models";

export interface ScreenplayFormatIssue {
  readonly path: string;
  readonly message: string;
}

export interface ScreenplayFormatValidation {
  readonly valid: boolean;
  readonly issues: readonly ScreenplayFormatIssue[];
}

const allowedVoices = new Set(["dialogue", "VO1", "VO2", "VO3", "OS"]);

export function validateScreenplayFormat(version: ScreenplayVersion): ScreenplayFormatValidation {
  const issues: ScreenplayFormatIssue[] = [];
  if (!version.metadata.title.trim() || !version.metadata.genre.trim() || !version.metadata.oneLineSynopsis.trim()) {
    issues.push({ path: "metadata", message: "Script metadata is incomplete" });
  }
  if (version.scenes.length === 0) issues.push({ path: "scenes", message: "At least one scene is required" });
  version.scenes.forEach((scene, index) => {
    const prefix = `scenes.${index}`;
    if (!scene.header.location.trim()) issues.push({ path: `${prefix}.header.location`, message: "Scene location is required" });
    if (scene.characters.length === 0) issues.push({ path: `${prefix}.characters`, message: "Scene cast is required" });
    if (!scene.actions.length && !scene.dialogues.length) issues.push({ path: prefix, message: "Scene needs shootable action or dialogue" });
    scene.actions.forEach((action, actionIndex) => {
      if (!action.subject.trim() || !action.description.trim()) issues.push({ path: `${prefix}.actions.${actionIndex}`, message: "Action needs a clear subject and description" });
    });
    scene.dialogues.forEach((line, lineIndex) => {
      if (!line.speaker.trim() || !line.text.trim()) issues.push({ path: `${prefix}.dialogues.${lineIndex}`, message: "Dialogue needs speaker and text" });
      if (!line.emotion?.trim()) issues.push({ path: `${prefix}.dialogues.${lineIndex}.emotion`, message: "Dialogue needs an emotion label" });
      if (line.voiceType && !allowedVoices.has(line.voiceType)) issues.push({ path: `${prefix}.dialogues.${lineIndex}.voiceType`, message: "Unsupported voice type" });
    });
  });
  if (!version.qualitySelfCheck.endingHook.trim()) issues.push({ path: "qualitySelfCheck.endingHook", message: "Episode ending hook is required" });
  return { valid: issues.length === 0, issues };
}
