import type { GenerationEvent, GenerationRequest, ModelAdapter } from "./model-adapter";
import { ModelError } from "./model-errors";

export interface GenerationResult { text: string; value?: unknown; events: readonly GenerationEvent[]; }

export async function runGeneration(adapter: ModelAdapter, request: GenerationRequest, options: { signal?: AbortSignal; onEvent?: (event: GenerationEvent) => void } = {}): Promise<GenerationResult> {
  const events: GenerationEvent[] = [];
  let text = "";
  let value: unknown;
  try {
    for await (const event of adapter.generate(request, options.signal)) {
      events.push(event);
      options.onEvent?.(event);
      if (event.type === "delta") text += event.text;
      if (event.type === "completed") { text = event.text; value = event.value; }
      if (event.type === "failed") throw event.error;
    }
  } catch (error) {
    if (error instanceof ModelError) throw error;
    throw new ModelError("server", error instanceof Error ? error.message : String(error), { cause: error });
  }
  return { text, ...(value === undefined ? {} : { value }), events };
}
