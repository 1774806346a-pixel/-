import type { ScoreReport } from "../../domain/models";

export function ScoreReportPanel({ report }: { report: ScoreReport }) {
  return <section className="score-report-panel" aria-label="评分报告"><div className="section-heading"><div><p className="section-label">剧本诊断</p><h3>{report.targetProfile}</h3></div><strong>{report.overallScore.toFixed(1)} / 100</strong></div><div className="score-dimensions">{report.dimensions.map((dimension) => <article className="score-dimension" key={dimension.key}><div><strong>{dimension.key}</strong><span>{dimension.score} 分 · 权重 {(dimension.weight * 100).toFixed(0)}%</span></div><p>{dimension.reason}</p><ul>{dimension.evidence.map((evidence, index) => <li key={`${evidence.location}-${index}`}><button type="button" className="evidence-link">{evidence.location}</button> {evidence.quote}</li>)}</ul><small>建议：{dimension.suggestion}</small></article>)}</div></section>;
}

