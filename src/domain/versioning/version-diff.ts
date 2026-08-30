import type { LockedFact, ScreenplayVersion } from "../models";
import type { ChangeNotice } from "../rules/locked-facts";
import { detectLockedFactChanges } from "../rules/locked-facts";

export interface VersionDiffEntry {
  readonly type: "added" | "removed" | "changed";
  readonly before?: string;
  readonly after?: string;
  readonly location: string;
}

export interface VersionDiff {
  readonly fromVersionId: string;
  readonly toVersionId: string;
  readonly entries: readonly VersionDiffEntry[];
  readonly notices: readonly ChangeNotice[];
}

export function diffScreenplayVersions(before: ScreenplayVersion, after: ScreenplayVersion, lockedFacts: readonly LockedFact[] = []): VersionDiff {
  const oldLines = (before.bodyMarkdown ?? "").split(/\r?\n/);
  const newLines = (after.bodyMarkdown ?? "").split(/\r?\n/);
  const entries: VersionDiffEntry[] = [];
  const length = Math.max(oldLines.length, newLines.length);
  for (let index = 0; index < length; index += 1) {
    const oldLine = oldLines[index];
    const newLine = newLines[index];
    if (oldLine === newLine) continue;
    if (oldLine === undefined) entries.push({ type: "added", after: newLine, location: `line ${index + 1}` });
    else if (newLine === undefined) entries.push({ type: "removed", before: oldLine, location: `line ${index + 1}` });
    else entries.push({ type: "changed", before: oldLine, after: newLine, location: `line ${index + 1}` });
  }
  return { fromVersionId: before.id, toVersionId: after.id, entries, notices: detectLockedFactChanges(before, after, lockedFacts).notices };
}

export function canPromoteVersion(diff: VersionDiff, confirmations: readonly string[] = []): boolean {
  return diff.notices.every((notice) => notice.confirmed || confirmations.includes(notice.id));
}
