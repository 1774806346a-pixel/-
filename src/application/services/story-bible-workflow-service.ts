import type { CharacterDefinition, LockedFact, LockedFactCategory, ScreenplayVersion, StoryBible } from "../../domain/models";
import { storyBibleSchema, type StoryBibleOutput } from "../../domain/schemas/story-bible.schema";
import type { IdeaDiagnosis, SourceAnalysis } from "../../domain/schemas/intake.schema";

export type StoryBibleDocument = StoryBibleOutput;

export interface StoryBibleChangeNotice {
  readonly factId: string;
  readonly category: LockedFactCategory;
  readonly before: string;
  readonly after: string;
  readonly sourceLocation: string;
  readonly requiresConfirmation: true;
}

export interface StoryBibleUpdateResult {
  readonly bible: StoryBibleDocument;
  readonly notices: readonly StoryBibleChangeNotice[];
}

export interface StoryBiblePatch {
  readonly characters?: readonly CharacterDefinition[];
  readonly assets?: readonly string[];
  readonly timeline?: readonly string[];
  readonly relationships?: readonly string[];
  readonly worldRules?: readonly string[];
  readonly scenes?: readonly string[];
  readonly props?: readonly string[];
  readonly uiElements?: readonly string[];
  readonly pendingConfirmations?: readonly string[];
}

type IntakeLike = Pick<IdeaDiagnosis | SourceAnalysis, "characters" | "conflicts" | "events" | "structureNodes" | "dialogue" | "actions" | "pendingConfirmations"> & { summary?: string };

const now = () => new Date().toISOString();
const id = (prefix: string) => globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function validate(bible: unknown): StoryBibleDocument {
  const parsed = storyBibleSchema.safeParse(bible);
  if (!parsed.success) {
    throw new Error(`Story bible schema validation failed: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}

function factForCharacter(character: CharacterDefinition, index: number, projectId: string): LockedFact {
  return { id: `${projectId}:bible:person-${index + 1}`, category: "person", value: `${character.name}: ${character.identity}; ${character.appearance}; ${character.personality}`, sourceLocation: `characters[${index}]`, locked: true };
}

/** Coordinates story-bible extraction and controlled edits while preserving locked facts. */
export class StoryBibleWorkflowService {
  createFromScreenplay(screenplay: ScreenplayVersion): StoryBibleDocument {
    if (screenplay.status !== "confirmed") throw new Error("Only confirmed screenplay versions can create a story bible");
    const timestamp = now();
    const lockedFacts: LockedFact[] = screenplay.characters.map((character, index) => factForCharacter(character, index, screenplay.projectId));
    screenplay.scenes.forEach((scene, index) => lockedFacts.push({ id: `${screenplay.projectId}:bible:timeline-${index + 1}`, category: "timeline", value: `${scene.header.location} / ${scene.header.timeOfDay}`, sourceLocation: `scenes[${index}].header`, locked: true }));
    lockedFacts.push({ id: `${screenplay.projectId}:bible:plot`, category: "plot", value: screenplay.metadata.oneLineSynopsis, sourceLocation: "metadata.oneLineSynopsis", locked: true });
    return validate({ id: `${screenplay.projectId}:bible:${screenplay.id}`, projectId: screenplay.projectId, schemaVersion: 1, characters: screenplay.characters.map((character) => ({ ...character, locked: true })), assets: [], lockedFacts, timeline: screenplay.scenes.map((scene) => `${scene.sequence}. ${scene.header.location} / ${scene.header.timeOfDay}${scene.heading ? ` / ${scene.heading}` : ""}`), createdAt: timestamp, updatedAt: timestamp });
  }

  extract(screenplay: ScreenplayVersion): StoryBibleDocument {
    return this.createFromScreenplay(screenplay);
  }

  /** Builds a bible from either idea diagnosis or source-analysis output. */
  createFromIntake(projectId: string, analysis: IntakeLike): StoryBibleDocument {
    const timestamp = now();
    const characters = analysis.characters.map((character, index) => ({
      id: `${projectId}:bible:character-${index + 1}`,
      name: character.name,
      identity: character.role ?? "待确认",
      appearance: character.description ?? "待确认",
      personality: "待确认",
      locked: true,
    }));
    const facts: LockedFact[] = characters.map((character, index) => factForCharacter(character, index, projectId));
    analysis.conflicts.forEach((conflict, index) => facts.push({ id: `${projectId}:bible:plot-${index + 1}`, category: "plot", value: conflict.description, sourceLocation: `conflicts[${index}]`, locked: true }));
    analysis.events.forEach((event, index) => facts.push({ id: `${projectId}:bible:timeline-${index + 1}`, category: "timeline", value: event.description, sourceLocation: `events[${index}]`, locked: true }));
    const timeline = analysis.events.map((event, index) => `${event.order ?? index + 1}. ${event.description}`);
    const relationships = analysis.conflicts.flatMap((conflict) => conflict.participants.length > 1 ? [conflict.participants.join(" / ")] : []);
    const scenes = analysis.structureNodes.map((node) => node.title);
    return validate({
      id: `${projectId}:bible:${id("snapshot")}`,
      projectId,
      schemaVersion: 1,
      characters,
      assets: [],
      lockedFacts: facts,
      timeline,
      relationships,
      worldRules: [],
      scenes,
      props: [],
      uiElements: [],
      pendingConfirmations: analysis.pendingConfirmations.map((item) => typeof item === "string" ? item : item.description),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  createFromDiagnosis(projectId: string, diagnosis: IdeaDiagnosis): StoryBibleDocument {
    return this.createFromIntake(projectId, diagnosis);
  }

  createFromAnalysis(projectId: string, analysis: SourceAnalysis): StoryBibleDocument {
    return this.createFromIntake(projectId, analysis);
  }

  update(current: StoryBibleDocument, patch: StoryBiblePatch, confirmations: readonly string[] = []): StoryBibleUpdateResult {
    const proposed = validate({ ...current, ...patch, updatedAt: now() });
    const notices: StoryBibleChangeNotice[] = [];
    for (const fact of current.lockedFacts.filter((item) => item.locked)) {
      const matching = proposed.lockedFacts.find((item) => item.id === fact.id);
      const derivedAfter = this.deriveFactValue(proposed, fact);
      const characterMatch = /^characters\[(\d+)\]$/.exec(fact.sourceLocation);
      const beforeCharacter = characterMatch ? current.characters[Number(characterMatch[1])] : undefined;
      const afterCharacter = characterMatch ? proposed.characters[Number(characterMatch[1])] : undefined;
      const characterChanged = beforeCharacter && afterCharacter && JSON.stringify(beforeCharacter) !== JSON.stringify(afterCharacter);
      if (!matching || matching.value !== fact.value || characterChanged || (derivedAfter !== undefined && derivedAfter !== fact.value)) {
        notices.push({ factId: fact.id, category: fact.category, before: fact.value, after: derivedAfter ?? matching?.value ?? "(missing)", sourceLocation: fact.sourceLocation, requiresConfirmation: true });
      }
    }
    const synchronizedFacts = proposed.lockedFacts.map((fact) => {
      const notice = notices.find((item) => item.factId === fact.id);
      return notice && !confirmations.includes(fact.id) ? current.lockedFacts.find((item) => item.id === fact.id) ?? fact : fact;
    });
    const pending = [...(proposed.pendingConfirmations ?? []), ...notices.filter((notice) => !confirmations.includes(notice.factId)).map((notice) => `Confirm locked fact change: ${notice.factId}`)];
    return { bible: validate({ ...proposed, lockedFacts: synchronizedFacts, pendingConfirmations: [...new Set(pending)] }), notices };
  }

  private deriveFactValue(bible: StoryBibleDocument, fact: LockedFact): string | undefined {
    const personMatch = /^characters\[(\d+)\]$/.exec(fact.sourceLocation);
    if (personMatch) {
      const character = bible.characters[Number(personMatch[1])];
      return character ? `${character.name}: ${character.identity}; ${character.appearance}; ${character.personality}` : undefined;
    }
    const timelineMatch = /^events\[(\d+)\]$/.exec(fact.sourceLocation);
    if (timelineMatch) return bible.timeline[Number(timelineMatch[1])];
    if (fact.category === "timeline") {
      const index = Number((/\[(\d+)\]/.exec(fact.sourceLocation) ?? [])[1]);
      return Number.isFinite(index) ? bible.timeline[index] : undefined;
    }
    return undefined;
  }

  edit(current: StoryBibleDocument, patch: StoryBiblePatch, confirmations: readonly string[] = []): StoryBibleUpdateResult {
    return this.update(current, patch, confirmations);
  }

  lockFact(current: StoryBibleDocument, factId: string): StoryBibleDocument {
    const fact = current.lockedFacts.find((item) => item.id === factId);
    if (!fact) throw new Error(`Locked fact not found: ${factId}`);
    return validate({ ...current, lockedFacts: current.lockedFacts.map((item) => item.id === factId ? { ...item, locked: true } : item), updatedAt: now() });
  }

  /** Returns the impact of a proposed edit without applying it. */
  previewUpdate(current: StoryBibleDocument, patch: StoryBiblePatch): readonly StoryBibleChangeNotice[] {
    const proposed = validate({ ...current, ...patch, updatedAt: now() });
    return current.lockedFacts.filter((item) => item.locked).flatMap((fact) => {
      const matching = proposed.lockedFacts.find((item) => item.id === fact.id);
      const derivedAfter = this.deriveFactValue(proposed, fact);
      return !matching || matching.value !== fact.value || (derivedAfter !== undefined && derivedAfter !== fact.value)
        ? [{ factId: fact.id, category: fact.category, before: fact.value, after: derivedAfter ?? matching?.value ?? "(missing)", sourceLocation: fact.sourceLocation, requiresConfirmation: true as const }]
        : [];
    });
  }

  unlockFact(current: StoryBibleDocument, factId: string): StoryBibleDocument {
    const fact = current.lockedFacts.find((item) => item.id === factId);
    if (!fact) throw new Error(`Locked fact not found: ${factId}`);
    return validate({ ...current, lockedFacts: current.lockedFacts.map((item) => item.id === factId ? { ...item, locked: false } : item), updatedAt: now() });
  }

  lock(current: StoryBibleDocument, factId: string): StoryBibleDocument { return this.lockFact(current, factId); }
  unlock(current: StoryBibleDocument, factId: string): StoryBibleDocument { return this.unlockFact(current, factId); }

  updateFact(current: StoryBibleDocument, factId: string, value: string, confirmations: readonly string[] = []): StoryBibleUpdateResult {
    const fact = current.lockedFacts.find((item) => item.id === factId);
    if (!fact) throw new Error(`Locked fact not found: ${factId}`);
    const notices = fact.value === value ? [] : [{ factId, category: fact.category, before: fact.value, after: value, sourceLocation: fact.sourceLocation, requiresConfirmation: true as const }];
    if (fact.locked && !confirmations.includes(factId)) {
      return { bible: validate({ ...current, pendingConfirmations: [...new Set([...(current.pendingConfirmations ?? []), `Confirm locked fact change: ${factId}`])], updatedAt: now() }), notices };
    }
    const bible = validate({ ...current, lockedFacts: current.lockedFacts.map((item) => item.id === factId ? { ...item, value, locked: true } : item), updatedAt: now() });
    return { bible, notices };
  }

  addFact(current: StoryBibleDocument, input: Omit<LockedFact, "id"> & { id?: string }): StoryBibleDocument {
    const fact = { ...input, id: input.id ?? id("fact") };
    if (current.lockedFacts.some((item) => item.id === fact.id)) throw new Error(`Locked fact already exists: ${fact.id}`);
    return validate({ ...current, lockedFacts: [...current.lockedFacts, fact], updatedAt: now() });
  }

  removeFact(current: StoryBibleDocument, factId: string, confirmations: readonly string[] = []): StoryBibleDocument {
    const fact = current.lockedFacts.find((item) => item.id === factId);
    if (!fact) throw new Error(`Locked fact not found: ${factId}`);
    if (fact.locked && !confirmations.includes(factId)) throw new Error(`Locked story-bible fact requires confirmation: ${factId}`);
    return validate({ ...current, lockedFacts: current.lockedFacts.filter((item) => item.id !== factId), updatedAt: now() });
  }
}

export function createStoryBibleWorkflowService(): StoryBibleWorkflowService { return new StoryBibleWorkflowService(); }
