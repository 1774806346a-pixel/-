import { useState } from "react";
import type { ScreenplayVersion } from "../../domain/models";
import type { RewriteScope } from "../../application/services/screenplay-rewrite-service";

export function RewritePanel({ onRewrite }: { readonly onRewrite: (scope: RewriteScope, prompt: string) => Promise<void> }) {
  const [scope, setScope] = useState<RewriteScope>({ kind: "full" });
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); try { await onRewrite(scope, prompt); } finally { setBusy(false); } };
  return <section aria-label="可控改写"><label>改写范围 <select value={scope.kind} onChange={(event) => setScope({ kind: event.target.value as RewriteScope["kind"] })}><option value="full">全文</option><option value="episode">单集</option><option value="scene">场次</option><option value="paragraph">段落</option></select></label><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="输入改写要求" /><button type="button" disabled={busy || !prompt.trim()} onClick={() => void submit()}>{busy ? "生成中..." : "生成改写"}</button></section>;
}

export type { ScreenplayVersion };
