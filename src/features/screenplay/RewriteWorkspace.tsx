import { useState } from "react";
import type { RewriteScope } from "../../application/services/screenplay-rewrite-service";
import type { RewriteWorkflowResult } from "../../application/services/rewrite-workflow-service";

export function RewriteWorkspace({ onGenerate, onConfirm, result }: { onGenerate: (scope: RewriteScope, prompt: string) => Promise<void>; onConfirm?: (result: RewriteWorkflowResult) => Promise<void>; result?: RewriteWorkflowResult | null }) {
  const [scope, setScope] = useState<RewriteScope>({ kind: "full" });
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="rewrite-workspace" aria-label="受控改写"><div className="section-heading"><strong>受控改写</strong><span>候选版本不会覆盖原稿</span></div><label>改写范围<select value={scope.kind} onChange={(event) => setScope({ kind: event.target.value as RewriteScope["kind"] })}><option value="full">全文</option><option value="episode">单集</option><option value="scene">场次</option><option value="paragraph">段落</option></select></label><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="输入改写要求" /><button type="button" disabled={busy || !prompt.trim()} onClick={async () => { setBusy(true); try { await onGenerate(scope, prompt); } finally { setBusy(false); } }}>{busy ? "生成中..." : "生成改写候选"}</button>{result && <div className="rewrite-result"><p>{result.record.changeSummary}</p>{result.notices.length > 0 && <p className="impact-warning">检测到 {result.notices.length} 条锁定事实影响，确认后才能保存。</p>}<button type="button" disabled={!onConfirm} onClick={() => result && onConfirm?.(result)}>确认并保存新版本</button></div>}</section>;
}

