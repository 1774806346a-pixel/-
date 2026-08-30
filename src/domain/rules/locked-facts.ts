import type { LockedFact, ScreenplayVersion } from "../models";
import { compareProtectedText, type SourceVoiceLedgerEntry } from "../../application/services/source-voice-ledger";

export interface ChangeNotice {
  readonly id: string;
  readonly category: "locked-fact" | "protected-text" | "character" | "relationship" | "world" | "timeline" | "plot";
  readonly before: string;
  readonly after: string;
  readonly location: string;
  readonly severity: "info" | "major" | "critical";
  readonly requiresConfirmation: boolean;
  readonly confirmed: boolean;
}

export interface LockedFactsCheck {
  readonly valid: boolean;
  readonly notices: readonly ChangeNotice[];
}

const noticeId = () => globalThis.crypto?.randomUUID?.() ?? `change-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function versionText(version: ScreenplayVersion): string {
  return version.bodyMarkdown ?? [version.title, ...version.characters.map((character) => `${character.name} ${character.identity}`), ...version.scenes.flatMap((scene) => [scene.header.location, ...scene.actions.map((action) => action.description), ...scene.dialogues.map((line) => line.text)])].join("\n");
}

export function detectLockedFactChanges(before: ScreenplayVersion, after: ScreenplayVersion, facts: readonly LockedFact[]): LockedFactsCheck {
  const beforeText = versionText(before);
  const afterText = versionText(after);
  const notices: ChangeNotice[] = [];
  for (const fact of facts.filter((item) => item.locked)) {
    const beforeHas = beforeText.includes(fact.value);
    const afterHas = afterText.includes(fact.value);
    if (beforeHas && !afterHas) notices.push({ id: noticeId(), category: fact.category === "person" ? "character" : fact.category, before: fact.value, after: "(missing)", location: fact.sourceLocation, severity: "critical", requiresConfirmation: true, confirmed: false });
  }
  return { valid: notices.length === 0, notices };
}

export function detectProtectedTextChanges(before: readonly SourceVoiceLedgerEntry[], after: readonly SourceVoiceLedgerEntry[] | readonly string[]): LockedFactsCheck {
  const comparison = compareProtectedText(before, after);
  if (comparison.valid) return { valid: true, notices: [] };
  return {
    valid: false,
    notices: comparison.errors.map((error): ChangeNotice => ({ id: noticeId(), category: "protected-text", before: before.map((entry) => entry.text).join(" "), after: `${after.map((entry) => typeof entry === "string" ? entry : entry.text).join(" ")} [${error}]`, location: "voice-ledger", severity: "critical", requiresConfirmation: true, confirmed: false })),
  };
}

export function confirmChange(notice: ChangeNotice): ChangeNotice { return { ...notice, confirmed: true }; }
