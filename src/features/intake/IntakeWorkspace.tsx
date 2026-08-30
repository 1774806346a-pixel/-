import { useRef, useState, type ReactNode } from "react";
import type {
  IdeaDiagnosis,
  SourceAnalysis,
} from "../../domain/schemas/intake.schema";

export type IntakeMode = "idea" | "source";
export interface IntakeWorkspaceProps {
  source: string;
  sourceSaved: boolean;
  onSourceChange: (value: string) => void;
  onSaveSource: () => Promise<void>;
  onDiagnoseIdea: (
    input: string,
    signal: AbortSignal,
  ) => Promise<IdeaDiagnosis>;
  onAnalyzeSource: (
    input: string,
    signal: AbortSignal,
  ) => Promise<SourceAnalysis>;
  result?: IdeaDiagnosis | SourceAnalysis | null;
}

export function IntakeWorkspace(props: IntakeWorkspaceProps) {
  const [mode, setMode] = useState<IntakeMode>("source");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const run = async () => {
    if (!props.source.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setMessage(mode === "idea" ? "创意诊断进行中…" : "原稿分析进行中…");
    try {
      if (mode === "idea")
        await props.onDiagnoseIdea(props.source, controller.signal);
      else await props.onAnalyzeSource(props.source, controller.signal);
      setMessage("分析完成");
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const cancel = () => {
    abortRef.current?.abort();
    setBusy(false);
    setMessage("已取消");
  };
  const renderItems = (
    title: string,
    items: readonly unknown[],
    render: (item: any, index: number) => ReactNode,
  ) =>
    items.length ? (
      <section className="result-block">
        <h4>
          {title} ({items.length})
        </h4>
        {items.map(render)}
      </section>
    ) : null;
  return (
    <div className="intake-workspace">
      <div className="intake-modes" role="tablist" aria-label="输入模式">
        <button
          type="button"
          className={mode === "idea" ? "active" : "secondary-button"}
          onClick={() => setMode("idea")}
        >
          创意诊断
        </button>
        <button
          type="button"
          className={mode === "source" ? "active" : "secondary-button"}
          onClick={() => setMode("source")}
        >
          原稿分析
        </button>
      </div>
      <textarea
        aria-label="创意或剧本"
        readOnly={props.sourceSaved && mode === "source"}
        value={props.source}
        onChange={(event) => props.onSourceChange(event.target.value)}
        placeholder="粘贴一句创意、小说章节或已有剧本"
      />
      <div className="source-actions">
        <button
          type="button"
          disabled={props.sourceSaved || !props.source.trim()}
          onClick={() => void props.onSaveSource()}
        >
          保存原稿
        </button>
        <button
          type="button"
          disabled={busy || !props.source.trim()}
          onClick={() => void run()}
        >
          {mode === "idea" ? "开始创意诊断" : "开始分析"}
        </button>
        {busy && (
          <button className="secondary-button" type="button" onClick={cancel}>
            取消
          </button>
        )}
      </div>
      {message && (
        <p className="intake-status" role="status">
          {message}
        </p>
      )}
      {props.result && (
        <div className="analysis-result">
          <div className="result-heading">
            <strong>
              {props.result.inputType === "idea"
                ? "创意诊断结果"
                : "原稿分析结果"}
            </strong>
            <small>
              {props.result.modelMetadata.modelName
                ? `模型：${props.result.modelMetadata.modelName}`
                : "确定性解析"}
            </small>
          </div>
          <p className="result-summary">{props.result.summary}</p>
          {props.result.score && (
            <section className="result-score">
              <strong>模型评分：{props.result.score.overall}/100</strong>
              {props.result.score.dimensions.map((dimension) => (
                <div key={dimension.key}>
                  <span>{dimension.label ?? dimension.key}</span>
                  <b>{dimension.score}</b>
                  <small>{dimension.reason}</small>
                </div>
              ))}
            </section>
          )}
          <div className="result-metrics">
            <span>人物 {props.result.characters.length}</span>
            <span>冲突 {props.result.conflicts.length}</span>
            <span>事件 {props.result.events.length}</span>
            <span>对白 {props.result.dialogue.length}</span>
            <span>动作 {props.result.actions.length}</span>
            <span>待确认 {props.result.pendingConfirmations.length}</span>
          </div>
          {renderItems("人物", props.result.characters, (item, index) => (
            <article key={`character-${index}`}>
              <strong>{item.name}</strong>
              {item.role && <span> · {item.role}</span>}
              {item.description && <p>{item.description}</p>}
            </article>
          ))}
          {renderItems("核心冲突", props.result.conflicts, (item, index) => (
            <article key={`conflict-${index}`}>
              <strong>{item.description}</strong>
              {item.participants?.length ? (
                <small>参与者：{item.participants.join("、")}</small>
              ) : null}
            </article>
          ))}
          {renderItems("关键事件", props.result.events, (item, index) => (
            <article key={`event-${index}`}>
              <strong>
                {item.order ? `${item.order}. ` : ""}
                {item.description}
              </strong>
            </article>
          ))}
          {renderItems(
            "结构节点",
            props.result.structureNodes,
            (item, index) => (
              <article key={`structure-${index}`}>
                <strong>{item.title}</strong>
                <span>
                  {item.type}
                  {item.needsReview ? " · 需要复核" : ""}
                </span>
                {item.summary && <p>{item.summary}</p>}
              </article>
            ),
          )}
          {renderItems("对白摘录", props.result.dialogue, (item, index) => (
            <article key={`dialogue-${index}`}>
              <strong>{item.speaker}</strong>
              <p>
                “{item.text}”{item.emotion ? `（${item.emotion}）` : ""}
              </p>
            </article>
          ))}
          {renderItems("动作摘录", props.result.actions, (item, index) => (
            <article key={`action-${index}`}>
              <p>{item.description}</p>
            </article>
          ))}
          {props.result.pendingConfirmations.length > 0 && (
            <section className="result-block pending">
              <h4>待确认事项</h4>
              {props.result.pendingConfirmations.map((item, index) => (
                <p key={`pending-${index}`}>
                  • {typeof item === "string" ? item : item.description}
                </p>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
