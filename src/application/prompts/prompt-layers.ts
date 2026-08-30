export const PROMPT_LAYER_VERSION = "prompt-layers/v1" as const;

export interface PromptLayer {
  readonly name: "internal-policy" | "story-bible" | "task" | "user" | "schema";
  readonly promptVersion: string;
  readonly content: string;
}

export interface PromptLayerInput {
  readonly internalPolicy: PromptLayer;
  readonly storyBible: PromptLayer;
  readonly task: PromptLayer;
  readonly user?: PromptLayer;
  readonly schema: PromptLayer;
}

export interface MergedPrompt {
  readonly promptVersion: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly layers: readonly PromptLayer[];
}

const requiredOrder = ["internal-policy", "story-bible", "task", "user", "schema"] as const;

function validateLayer(layer: PromptLayer, expected: PromptLayer["name"]): void {
  if (layer.name !== expected) {
    throw new Error(`Prompt layer order violation: expected ${expected}, got ${layer.name}`);
  }
  if (!layer.promptVersion.trim() || !layer.content.trim()) {
    throw new Error(`Prompt layer ${layer.name} must include a version and content`);
  }
}

/**
 * Keeps non-overridable policy ahead of user preferences. The model receives the
 * exact layer order as visible delimiters, making generation records reproducible.
 */
export function mergePromptLayers(input: PromptLayerInput): MergedPrompt {
  const layers = [
    input.internalPolicy,
    input.storyBible,
    input.task,
    input.user ?? { name: "user", promptVersion: "user-prompt/v1", content: "No additional user direction." },
    input.schema,
  ] as const;

  layers.forEach((layer, index) => validateLayer(layer, requiredOrder[index]!));
  const promptVersion = layers.map((layer) => `${layer.name}@${layer.promptVersion}`).join("|");
  // Put the layer payload first so content-level ordering remains observable to
  // callers and tests while retaining versioned delimiters for model tracing.
  const render = (layer: PromptLayer) => `${layer.content}\n### ${layer.name} (${layer.promptVersion})`;
  return {
    promptVersion,
    systemPrompt: layers.slice(0, 3).map(render).join("\n\n"),
    userPrompt: layers.slice(3).map(render).join("\n\n"),
    layers,
  };
}
