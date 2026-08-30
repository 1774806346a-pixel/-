import { useMemo, useState } from "react";
import type { ScreenplayVersion, StoryBible } from "../../domain/models";
import { VersionService } from "../../application/services/version-service";
import { DiffRenderer } from "../../application/renderers/diff-renderer";
import type { VersionDiff } from "../../domain/versioning/version-diff";

export interface VersionCenterProps {
  readonly versions: readonly ScreenplayVersion[];
  readonly storyBible?: StoryBible | null;
  readonly activeVersionId?: string | null;
  readonly onRestore?: (version: ScreenplayVersion) => Promise<void> | void;
  readonly onConfirm?: (version: ScreenplayVersion) => Promise<void> | void;
  readonly onSelect?: (version: ScreenplayVersion) => void;
}
const labels: Record<ScreenplayVersion["status"], string> = { draft: "草稿", "pending-confirmation": "待确认", confirmed: "已确认", archived: "已归档" };

export function VersionCenter({ versions, storyBible, activeVersionId, onRestore, onConfirm, onSelect }: VersionCenterProps) {
  const service = useMemo(() => new VersionService({ saveVersion: async (version) => version }), []);
  const ordered = useMemo(() => [...versions].sort((a, b) => b.versionNumber - a.versionNumber), [versions]);
  const [selectedId, setSelectedId] = useState(activeVersionId ?? ordered[0]?.id);
  const [compareId, setCompareId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const selected = ordered.find((version) => version.id === selectedId) ?? ordered[0];
  const compare = ordered.find((version) => version.id === compareId);
  const diff: VersionDiff | null = selected && compare ? service.diff(compare, selected, storyBible) : null;
  async function run(action: "restore" | "confirm", version: ScreenplayVersion) {
    const callback = action === "restore" ? onRestore : onConfirm;
    if (!callback) return;
    setBusy(`${action}:${version.id}`);
    try { await callback(version); } finally { setBusy(null); }
  }
  if (ordered.length === 0) return <section className="version-center" aria-label="剧本版本中心"><div className="section-heading"><p className="section-label">版本中心</p><span>0 个版本</span></div><p className="empty">还没有剧本版本。完成解析或生成后，版本会显示在这里。</p></section>;
  return <section className="version-center" aria-label="剧本版本中心">
    <div className="section-heading"><div><p className="section-label">版本中心</p><h3>剧本版本与恢复</h3></div><span>{ordered.length} 个版本</span></div>
    <div className="version-layout"><div className="version-list" aria-label="版本列表">{ordered.map((version) => <button className={version.id === selected?.id ? "version-row selected" : "version-row"} type="button" key={version.id} onClick={() => { setSelectedId(version.id); onSelect?.(version); }}><span className="version-row-main"><strong>v{version.versionNumber} · {version.title}</strong><small>{labels[version.status]} · {new Date(version.updatedAt).toLocaleString()}</small></span><span className="version-lineage">{version.parentVersionId ? `父版本 ${version.parentVersionId.slice(0, 8)}` : "原始版本"}</span></button>)}</div>
      {selected && <div className="version-detail"><div className="version-detail-heading"><div><p className="section-label">当前版本</p><h4>v{selected.versionNumber} · {selected.title}</h4></div><span className={`version-status status-${selected.status}`}>{labels[selected.status]}</span></div><dl className="version-meta"><div><dt>版本 ID</dt><dd>{selected.id}</dd></div><div><dt>父版本</dt><dd>{selected.parentVersionId ?? "无"}</dd></div><div><dt>原文版本</dt><dd>{selected.sourceVersionId ?? "无"}</dd></div><div><dt>场景数</dt><dd>{selected.scenes.length}</dd></div></dl><div className="version-actions">{onConfirm && selected.status !== "confirmed" && <button type="button" disabled={busy !== null || Boolean(diff?.notices.some((notice) => !notice.confirmed))} onClick={() => void run("confirm", selected)}>{busy === `confirm:${selected.id}` ? "确认中…" : "确认剧本"}</button>}{onRestore && <button className="secondary-button" type="button" disabled={busy !== null} onClick={() => void run("restore", selected)}>{busy === `restore:${selected.id}` ? "恢复中…" : "恢复为新版本"}</button>}</div><label className="compare-control">对比版本<select value={compareId} onChange={(event) => setCompareId(event.target.value)}><option value="">选择一个父版本或历史版本</option>{ordered.filter((version) => version.id !== selected.id).map((version) => <option value={version.id} key={version.id}>v{version.versionNumber} · {version.title}</option>)}</select></label>{diff && <DiffRenderer diff={diff} />}{diff?.notices.length ? <aside className="impact-warning"><strong>锁定事实影响</strong><p>此版本修改了 {diff.notices.length} 条锁定事实，确认前请检查影响范围。</p></aside> : null}<details className="markdown-preview"><summary>查看 Markdown 正文</summary><pre>{selected.bodyMarkdown ?? "暂无 Markdown 正文"}</pre></details></div>}
    </div>
  </section>;
}
