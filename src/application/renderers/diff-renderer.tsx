import type { VersionDiff } from "../../domain/versioning/version-diff";

export function DiffRenderer({ diff }: { readonly diff: VersionDiff }) {
  return <section aria-label="版本差异"><h3>版本差异</h3><ul>{diff.entries.map((entry, index) => <li key={`${entry.location}-${index}`} data-change-type={entry.type}><strong>{entry.location}</strong> {entry.type === "changed" ? `${entry.before ?? ""} → ${entry.after ?? ""}` : entry.type === "added" ? `+ ${entry.after ?? ""}` : `- ${entry.before ?? ""}`}</li>)}</ul>{diff.notices.length > 0 && <aside><h4>待确认变更</h4><ul>{diff.notices.map((notice) => <li key={notice.id}>{notice.location}: {notice.before} → {notice.after}</li>)}</ul></aside>}</section>;
}
