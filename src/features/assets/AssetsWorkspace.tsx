import { useMemo, useState } from "react";
import type { Asset, AssetKind, BoardPrompt } from "../../domain/models";

const groups: Array<{ kind: Exclude<AssetKind, "ui">; label: string }> = [
  { kind: "scene", label: "场景" },
  { kind: "character", label: "人物" },
  { kind: "prop", label: "道具" },
];

export function AssetsWorkspace({ assets, boardPrompts = [], warnings = [] }: { assets: readonly Asset[]; boardPrompts?: readonly BoardPrompt[]; warnings?: readonly string[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const byKind = useMemo(() => new Map(groups.map(({ kind }) => [kind, assets.filter((asset) => asset.kind === kind)])), [assets]);
  async function copyPrompt(prompt: BoardPrompt) {
    try { await navigator.clipboard?.writeText(prompt.prompt); } catch { /* Clipboard permission is optional. */ }
    setCopiedId(prompt.assetId);
    window.setTimeout(() => setCopiedId((current) => current === prompt.assetId ? null : current), 1400);
  }
  return <section className="assets-workspace" aria-label="资产提取结果">
    <div className="section-heading"><strong>资产提取结果</strong><span>{assets.length} 项 · {boardPrompts.length} 条提示词</span></div>
    {warnings.length > 0 && <div className="asset-warning" role="status">{warnings.join("；")}</div>}
    {assets.length === 0 ? <p className="empty">当前项目没有可提取的已保存剧本。</p> : <div className="asset-groups">{groups.map(({ kind, label }) => {
      const items = byKind.get(kind) ?? [];
      return <section className="asset-group" key={kind} aria-label={label}><div className="section-heading"><strong>{label}</strong><span>{items.length} 项</span></div>{items.length === 0 ? <p className="empty">暂无{label}资产</p> : <div className="asset-list">{items.map((asset) => {
        const prompt = boardPrompts.find((item) => item.assetId === asset.id);
        return <article className="asset-row" key={asset.id}><div className="asset-row-heading"><div><strong>{asset.displayName}</strong><span>{asset.name}</span></div>{prompt && <button type="button" className="secondary-button" onClick={() => void copyPrompt(prompt)}>{copiedId === asset.id ? "已复制" : "复制提示词"}</button>}</div><p>{asset.description}</p><small>首次出现：第 {asset.firstAppearance.episode} 集 / {asset.firstAppearance.scene} · {asset.appearances.length} 次引用</small>{prompt && <details><summary>资产板提示词</summary><pre>{prompt.prompt}</pre><small>负面提示词：{prompt.avoid}</small></details>}</article>;
      })}</div>}</section>;
    })}</div>}
  </section>;
}
