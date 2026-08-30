import type { Asset, ScreenplayVersion } from "../../domain/models";
import type { PromptLayerInput } from "./prompt-layers";

export const ASSET_ANALYSIS_PROMPT_VERSION = "asset-analysis/v1" as const;

export function createAssetAnalysisPromptLayers(screenplays: readonly ScreenplayVersion[], existingAssets: readonly Asset[]): PromptLayerInput {
  const episodes = screenplays.map((version) => `Episode ${version.episodeNumber ?? version.versionNumber}:\n${version.bodyMarkdown ?? JSON.stringify(version)}`).join("\n\n");
  const library = existingAssets.length ? JSON.stringify(existingAssets.map((asset) => ({ kind: asset.kind, name: asset.name, displayName: asset.displayName, description: asset.description, appearances: asset.appearances }))) : "[]";
  return {
    internalPolicy: { name: "internal-policy", promptVersion: "asset-analysis-policy/v1", content: "Analyze the supplied screenplay material. Do not invent unsupported story facts. Keep existing assets unless the text explicitly contradicts them. Only return production-worthy scenes, characters, and props." },
    storyBible: { name: "story-bible", promptVersion: "asset-library/v1", content: `Existing project asset library (must be preserved):\n${library}` },
    task: { name: "task", promptVersion: ASSET_ANALYSIS_PROMPT_VERSION, content: `Screenplay episodes:\n${episodes || "No screenplay episodes supplied."}\n\nReturn a JSON object with an assets array. Each asset must contain kind (scene, character, or prop), displayName, description, aliases (array), firstAppearance ({episode, scene}), appearances (array of {episode, scene}), and worthProducing (boolean). Select only assets worth creating stable image references for.` },
    schema: { name: "schema", promptVersion: "asset-analysis-schema/v1", content: "JSON only. Shape: { assets: [{ kind, displayName, description, aliases, firstAppearance, appearances, worthProducing }] }." },
  };
}
