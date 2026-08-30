import type { ScoreDimensionKey } from "../models";

export interface ScoreDimensionDefinition {
  readonly key: ScoreDimensionKey;
  readonly label: string;
  readonly defaultWeight: number;
}

export const SCORE_DIMENSIONS: readonly ScoreDimensionDefinition[] = [
  { key: "hook", label: "开篇钩子", defaultWeight: 0.15 },
  { key: "conflict", label: "冲突", defaultWeight: 0.15 },
  { key: "characterMotivation", label: "人物动机", defaultWeight: 0.12 },
  { key: "pacing", label: "节奏", defaultWeight: 0.12 },
  { key: "reversal", label: "反转", defaultWeight: 0.12 },
  { key: "dialogue", label: "对白", defaultWeight: 0.10 },
  { key: "visualizability", label: "画面化能力", defaultWeight: 0.12 },
  { key: "continuity", label: "连续性", defaultWeight: 0.12 },
];

export const TARGET_PROFILES: Record<string, Record<ScoreDimensionKey, number>> = {
  "竖屏短剧": Object.fromEntries(SCORE_DIMENSIONS.map((item) => [item.key, item.defaultWeight])) as Record<ScoreDimensionKey, number>,
  "AI漫剧": { hook: 0.16, conflict: 0.14, characterMotivation: 0.10, pacing: 0.14, reversal: 0.12, dialogue: 0.08, visualizability: 0.16, continuity: 0.10 },
};
