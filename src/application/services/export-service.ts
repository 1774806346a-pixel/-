import type { ProjectGraph } from '../../domain/models';
import { renderScreenplayMarkdown } from '../renderers/screenplay-markdown-renderer';
import { renderBoardPromptMarkdown } from '../renderers/board-prompt-markdown-renderer';
import { renderShotGroupMarkdown } from '../renderers/shot-group-markdown-renderer';

export interface ProjectExport { screenplay: string; assets: string; boards: string; shots: string; json: string; }

export function exportProject(graph: ProjectGraph): ProjectExport {
  const screenplay = graph.screenplayVersions.map(renderScreenplayMarkdown).join('\n\n');
  const assets = graph.assets.map((asset) => `## ${asset.name}\n\n${asset.description}`).join('\n\n');
  const boards = graph.boardPrompts.map((prompt) => renderBoardPromptMarkdown(prompt, graph.assets.find((asset) => asset.id === prompt.assetId))).join('\n\n');
  const shots = graph.shotGroups.map(renderShotGroupMarkdown).join('\n\n');
  const json = JSON.stringify({ exportSchemaVersion: 1, project: graph.project, sourceDocuments: graph.sourceDocuments, screenplayVersions: graph.screenplayVersions, storyBible: graph.storyBible, scores: graph.scores, assets: graph.assets, boardPrompts: graph.boardPrompts, shotGroups: graph.shotGroups, generationRecords: graph.generationRecords }, null, 2);
  return { screenplay, assets, boards, shots, json };
}
