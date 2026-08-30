import type { SourceAnalysis, IdeaDiagnosis } from "../../domain/schemas/intake.schema";

export function ParseResultTree({ result }: { result: SourceAnalysis | IdeaDiagnosis }) {
  return <div className="parse-result-tree" aria-label="解析结果">
    <strong>结构节点</strong>
    <ul>{result.structureNodes.length === 0 ? <li>暂无结构节点</li> : result.structureNodes.map((node) => <li key={node.id}><span>{node.title}</span>{node.needsReview && <em>待复核</em>}{node.children && node.children.length > 0 && <ul>{node.children.map((child) => { const item = child as { id: string; title: string }; return <li key={item.id}>{item.title}</li>; })}</ul>}</li>)}</ul>
  </div>;
}
