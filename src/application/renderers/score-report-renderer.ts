import type { ScoreReport } from "../../domain/models";

export function renderScoreReportMarkdown(report: ScoreReport): string {
  const lines = [`# 剧本诊断：${report.targetProfile}`, `总体评分：${report.overallScore}`, ""];
  for (const dimension of report.dimensions) {
    lines.push(`## ${dimension.key} ${dimension.score}/100`, `权重：${dimension.weight}`, dimension.reason, `建议：${dimension.suggestion}`);
    for (const evidence of dimension.evidence) lines.push(`- 证据 [${evidence.location}]：${evidence.quote}${evidence.rationale ? `（${evidence.rationale}）` : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}
