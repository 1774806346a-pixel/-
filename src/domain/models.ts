/** Stable domain contracts shared by persistence, application services and UI. */

export type EntityId = string;
export type AssetKind = "character" | "scene" | "prop" | "ui";
export type ModelProvider = "ollama" | "openai-compatible";

export interface Project {
  id: EntityId;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  sourceDocumentIds: EntityId[];
  activeVersionId: EntityId | null;
  storyBibleId: EntityId | null;
  deletedAt?: string | null;
}

export interface SourceDocument {
  id: EntityId;
  projectId: EntityId;
  schemaVersion: number;
  kind: "idea" | "novel" | "chapter" | "outline" | "screenplay" | "template";
  title: string;
  body: string;
  sha256: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export type LockedFactCategory =
  "person" | "relationship" | "world" | "timeline" | "plot";

export interface LockedFact {
  id: EntityId;
  category: LockedFactCategory;
  value: string;
  sourceLocation: string;
  locked: boolean;
}

export interface GenerationRecord {
  id: EntityId;
  provider: ModelProvider;
  modelName: string;
  promptVersion: string;
  inputVersionId: EntityId;
  parameters: Record<string, number | string | boolean>;
  createdAt: string;
}

export interface ScreenplayMetadata {
  title: string;
  genre: string;
  elements: string[];
  episodeCount: number;
  episodeDurationSeconds: number;
  oneLineSynopsis: string;
  comparableWorks: string[];
  audience?: string;
  format?: string;
}

export interface CharacterDefinition {
  id: EntityId;
  name: string;
  age?: string;
  identity: string;
  appearance: string;
  personality: string;
  locked?: boolean;
}

export interface SceneHeader {
  location: string;
  timeOfDay: "day" | "night" | "dawn" | "dusk" | "unspecified";
  setting: "interior" | "exterior" | "mixed" | "unspecified";
}

export interface ActionLine {
  id?: EntityId;
  type: "action";
  subject: string;
  description: string;
  visualTag?: "action" | "screen" | "sound";
}

export type VoiceType = "dialogue" | "VO1" | "VO2" | "VO3" | "OS";

export interface DialogueLine {
  id?: EntityId;
  type: "dialogue" | "voice";
  speaker: string;
  text: string;
  emotion?: string;
  voiceType?: VoiceType;
  protected?: boolean;
  sourceLocation?: string;
}

export interface ScreenplayScene {
  id: EntityId;
  sequence: number;
  header: SceneHeader;
  heading?: string;
  characters: string[];
  actions: ActionLine[];
  dialogues: DialogueLine[];
  card?: "一卡" | "二卡";
  estimatedDurationSeconds?: number;
}

export interface AdaptationHandling {
  deleted: string[];
  rewritten: string[];
  compressed: string[];
  foreshadowing: string[];
  pendingConfirmation: string[];
}

export interface QualitySelfCheck {
  sceneCount: number;
  actionDescriptionRate: number;
  dialogueEmotionRate: number;
  wordCount: number;
  suspenseStrength: number;
  previousEpisodeCarryOver?: string;
  endingHook: string;
}

export interface ScreenplayVersion {
  id: EntityId;
  projectId: EntityId;
  schemaVersion: number;
  versionNumber: number;
  title: string;
  sourceVersionId: EntityId | null;
  parentVersionId: EntityId | null;
  status: "draft" | "confirmed" | "pending-confirmation" | "archived";
  metadata: ScreenplayMetadata;
  characters: CharacterDefinition[];
  scenes: ScreenplayScene[];
  adaptationHandling: AdaptationHandling;
  qualitySelfCheck: QualitySelfCheck;
  bodyMarkdown?: string;
  createdAt: string;
  updatedAt: string;
  /** Episodic authoring metadata; absent on legacy non-episodic versions. */
  episodeNumber?: number;
  entryType?: "creative" | "source";
  generationContext?: {
    entryType: "creative" | "source";
    source: string;
    outline?: string;
    previousEpisodes: Array<{ episodeNumber: number; screenplay: string }>;
  };
}

export type ScoreDimensionKey =
  | "hook"
  | "conflict"
  | "characterMotivation"
  | "pacing"
  | "reversal"
  | "dialogue"
  | "visualizability"
  | "continuity";

export interface ScoreEvidence {
  location: string;
  quote: string;
  rationale?: string;
}

export interface ScoreDimension {
  /** Built-in dimension key or a project-defined custom key. */
  key: ScoreDimensionKey | (string & {});
  label?: string;
  score: number;
  weight: number;
  reason: string;
  evidence: ScoreEvidence[];
  suggestion: string;
  suggestions?: string[];
  risk?: string;
  uncertainty?: string;
}

export interface ScoreTarget {
  profile: string;
  audience?: string;
  goals?: string[];
  constraints?: string[];
}

export interface ScoreReport {
  id: EntityId;
  projectId: EntityId;
  schemaVersion: number;
  inputVersionId: EntityId;
  targetProfile: string;
  target?: ScoreTarget;
  /** Effective weights used for this report, including custom dimensions. */
  weights?: Record<string, number>;
  overallScore: number;
  dimensions: ScoreDimension[];
  risks?: string[];
  recommendations?: string[];
  uncertainties?: string[];
  createdAt: string;
  generation?: GenerationRecord;
}

export interface AssetAppearance {
  episode: number;
  scene: string;
  shot?: string;
}

export interface Asset {
  id: EntityId;
  projectId: EntityId;
  schemaVersion: number;
  kind: AssetKind;
  name: string;
  displayName: string;
  description: string;
  firstAppearance: AssetAppearance;
  appearances: AssetAppearance[];
  aliases: string[];
  locked: boolean;
  deletedAt?: string | null;
}

export interface BoardPrompt {
  id: EntityId;
  assetId: EntityId;
  schemaVersion: number;
  purpose: string;
  styleBaseline: string;
  decomposition: string;
  colorConstraints?: string;
  layoutRequirements: string;
  prompt: string;
  avoid: string;
  reference?: {
    absolutePath: string;
    width: number;
    height: number;
    sha256: string;
  };
}

export interface StoryBible {
  id: EntityId;
  projectId: EntityId;
  schemaVersion: 1;
  characters: CharacterDefinition[];
  assets: EntityId[];
  lockedFacts: LockedFact[];
  timeline: string[];
  relationships?: string[];
  worldRules?: string[];
  scenes?: string[];
  props?: string[];
  uiElements?: string[];
  pendingConfirmations?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectGraph {
  project: Project;
  sourceDocuments: SourceDocument[];
  screenplayVersions: ScreenplayVersion[];
  storyBible: StoryBible | null;
  scores: ScoreReport[];
  assets: Asset[];
  boardPrompts: BoardPrompt[];
  shotGroups: ShotGroup[];
  generationRecords: GenerationRecord[];
}

export interface ShotTiming {
  start: number;
  end: number;
}

export interface TimedShot {
  shotId: string;
  timing: ShotTiming;
  transition: string;
  shotSize: string;
  cameraMovement: string;
  visualAction: string;
  sound: string;
  dialogueOrNarration: string;
  assetRefs: string[];
}

export interface FourGridCell {
  shotId: string;
  sceneName: string;
  shotSpecification: string;
  visualDescription: string;
  imagePrompt: string;
  colorScript: string;
}

export interface ShotGroup {
  id: EntityId;
  projectId: EntityId;
  schemaVersion: number;
  episode: number;
  sceneId: EntityId;
  durationSeconds: number;
  characterInfo: string;
  sceneInfo: string;
  propUiInfo: string;
  dialogueLock: string;
  continuity: string;
  styleGuide: string;
  shots: TimedShot[];
  fourGrid: FourGridCell[];
  videoPrompt: string;
  createdAt: string;
  updatedAt: string;
}
