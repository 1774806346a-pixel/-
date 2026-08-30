import type { LockedFact, ScreenplayVersion } from "../models";
import type { SourceVoiceLedgerEntry } from "../../application/services/source-voice-ledger";
import { compareProtectedText } from "../../application/services/source-voice-ledger";

export interface NoInventionViolation {
  readonly kind: "character" | "speaker" | "protected-text";
  readonly value: string;
  readonly location: string;
}

export interface NoInventionResult {
  readonly valid: boolean;
  readonly violations: readonly NoInventionViolation[];
}

function knownNames(source: ScreenplayVersion | undefined, facts: readonly LockedFact[]): Set<string> {
  if (!source) return new Set();
  const names = new Set(source?.characters.map((character) => character.name) ?? []);
  for (const fact of facts) {
    if (fact.locked && fact.category === "person") names.add(fact.value);
  }
  return names;
}

/** Rejects new named performers and altered protected source speech. */
export function validateNoInvention(
  candidate: ScreenplayVersion,
  options: {
    readonly sourceVersion?: ScreenplayVersion;
    readonly lockedFacts?: readonly LockedFact[];
    readonly protectedVoices?: readonly SourceVoiceLedgerEntry[];
  } = {},
): NoInventionResult {
  const violations: NoInventionViolation[] = [];
  const names = knownNames(options.sourceVersion, options.lockedFacts ?? []);
  if (names.size > 0) {
    for (const character of candidate.characters) {
      if (!names.has(character.name)) violations.push({ kind: "character", value: character.name, location: "characters" });
    }
    for (const scene of candidate.scenes) {
      for (const speaker of scene.characters) {
        if (!names.has(speaker)) violations.push({ kind: "speaker", value: speaker, location: scene.id });
      }
      for (const dialogue of scene.dialogues) {
        if (dialogue.speaker !== "VO" && dialogue.speaker !== "OS" && !names.has(dialogue.speaker)) {
          violations.push({ kind: "speaker", value: dialogue.speaker, location: scene.id });
        }
      }
    }
  }
  if (options.protectedVoices?.length) {
    const outputVoices = candidate.scenes.flatMap((scene) => scene.dialogues)
      .filter((line) => line.protected)
      .map((line) => line.text);
    const comparison = compareProtectedText(options.protectedVoices, outputVoices);
    if (!comparison.valid) {
      violations.push(...comparison.errors.map((value) => ({ kind: "protected-text" as const, value, location: "voice-ledger" })));
    }
  }
  return { valid: violations.length === 0, violations };
}
