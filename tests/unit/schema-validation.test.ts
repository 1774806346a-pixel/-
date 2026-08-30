import { describe, expect, it } from "vitest";
import { assetSchema } from "../../src/domain/schemas/asset.schema";
import { scoreReportSchema } from "../../src/domain/schemas/score.schema";
import { screenplaySchema } from "../../src/domain/schemas/screenplay.schema";
import { shotGroupSchema } from "../../src/domain/schemas/shot-group.schema";

const baseScreenplay = {
  id: "sp-1",
  projectId: "project-1",
  schemaVersion: 1,
  versionNumber: 1,
  title: "测试剧本",
  sourceVersionId: null,
  parentVersionId: null,
  status: "draft" as const,
  metadata: {
    title: "测试剧本",
    genre: "短剧",
    elements: ["悬疑"],
    episodeCount: 1,
    episodeDurationSeconds: 90,
    oneLineSynopsis: "一条线索改变命运",
    comparableWorks: [],
  },
  characters: [
    {
      id: "char-1",
      name: "林安",
      identity: "调查员",
      appearance: "短发",
      personality: "谨慎",
    },
  ],
  scenes: [
    {
      id: "scene-1",
      sequence: 1,
      header: {
        location: "仓库",
        timeOfDay: "night" as const,
        setting: "interior" as const,
      },
      characters: ["char-1"],
      actions: [
        {
          type: "action" as const,
          subject: "林安",
          description: "林安打开铁盒",
        },
      ],
      dialogues: [
        {
          type: "dialogue" as const,
          speaker: "林安",
          text: "这不可能。",
          emotion: "震惊",
        },
      ],
    },
  ],
  adaptationHandling: {
    deleted: [],
    rewritten: [],
    compressed: [],
    foreshadowing: [],
    pendingConfirmation: [],
  },
  qualitySelfCheck: {
    sceneCount: 1,
    actionDescriptionRate: 1,
    dialogueEmotionRate: 1,
    wordCount: 20,
    suspenseStrength: 80,
    endingHook: "铁盒中出现陌生照片",
  },
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:00.000Z",
};

const baseShotGroup = {
  id: "group-1",
  projectId: "project-1",
  schemaVersion: 1,
  episode: 1,
  sceneId: "scene-1",
  durationSeconds: 10,
  characterInfo: "林安，调查员",
  sceneInfo: "夜间仓库",
  propUiInfo: "@道具铁盒",
  dialogueLock: "林安台词逐字保留",
  continuity: "承接上一组",
  styleGuide: "写实动漫",
  shots: [1, 2, 3].map((n, index) => ({
    shotId: `shot-${n}`,
    timing: { start: index * 3, end: index * 3 + 3 },
    transition: "cut",
    shotSize: "中景",
    cameraMovement: "推近",
    visualAction: "林安观察铁盒",
    sound: "金属声",
    dialogueOrNarration: "",
    assetRefs: ["@道具铁盒"],
  })),
  fourGrid: [1, 2, 3, 1].map((n, index) => ({
    shotId: `shot-${n}`,
    sceneName: "夜间仓库",
    shotSpecification: "中景",
    visualDescription: `画面 ${index + 1}`,
    imagePrompt: "写实动漫画面",
    colorScript: "冷蓝",
  })),
  videoPrompt: "无字幕、无 BGM、动作连贯",
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:00.000Z",
};

describe("versioned domain schemas", () => {
  it("accepts a valid screenplay with scene, action and speaker-bearing dialogue", () => {
    expect(screenplaySchema.safeParse(baseScreenplay).success).toBe(true);
  });

  it("rejects a screenplay without scenes", () => {
    expect(
      screenplaySchema.safeParse({ ...baseScreenplay, scenes: [] }).success,
    ).toBe(false);
  });

  it("rejects dialogue without speaker", () => {
    const invalid = structuredClone(baseScreenplay);
    invalid.scenes[0].dialogues[0].speaker = "";
    expect(screenplaySchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an asset with an invalid category prefix", () => {
    const invalid = {
      id: "a-1",
      projectId: "p-1",
      schemaVersion: 1,
      kind: "character",
      name: "@场景仓库",
      displayName: "仓库",
      description: "仓库",
      firstAppearance: { episode: 1, scene: "1-1" },
      appearances: [],
      aliases: [],
      locked: false,
    };
    expect(assetSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an unknown four-grid shot ID", () => {
    const invalid = structuredClone(baseShotGroup);
    invalid.fourGrid[0].shotId = "shot-missing";
    expect(shotGroupSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects timed shots beyond the ten-second group", () => {
    const invalid = structuredClone(baseShotGroup);
    invalid.shots[2].timing.end = 10.1;
    expect(shotGroupSchema.safeParse(invalid).success).toBe(false);
  });

  it("requires all eight weighted score dimensions", () => {
    const invalid = {
      id: "score-1",
      projectId: "p-1",
      schemaVersion: 1,
      inputVersionId: "v-1",
      targetProfile: "竖屏短剧",
      overallScore: 70,
      dimensions: [],
      createdAt: "2026-08-27T00:00:00.000Z",
    };
    expect(scoreReportSchema.safeParse(invalid).success).toBe(false);
  });
});
