/* eslint-disable @typescript-eslint/ban-ts-comment, no-useless-escape */
// @ts-nocheck
export type ParsedNodeType =
  | 'metadata'
  | 'episode'
  | 'scene'
  | 'action'
  | 'dialogue'
  | 'inner-thought'
  | 'vo'
  | 'os'
  | 'card'
  | 'unknown';

export interface SourceLocation {
  lineStart: number;
  lineEnd: number;
}

export interface ParsedNode {
  type: ParsedNodeType;
  text: string;
  raw: string;
  location: SourceLocation;
  episodeNumber?: number;
  sceneId?: string;
  speaker?: string;
  needsReview?: boolean;
}

export interface ParsedEpisode {
  number: number;
  title?: string;
  location: SourceLocation;
  scenes: ParsedNode[];
}

export interface ParsedScreenplay {
  metadata: ParsedNode[];
  episodes: ParsedEpisode[];
  nodes: ParsedNode[];
  unknownNodes: ParsedNode[];
}

const metadataHeadings = new Set(['本次改编', '剧本信息', '主要人设', '故事梗概']);
const episodePattern = /^#{1,3}\s*第\s*([0-9一二三四五六七八九十百]+)\s*集(?:\s*[-:：]\s*(.*))?\s*$/;
const alternateEpisodePattern = /^#{1,3}\s*Episode\s*([0-9]+)(?:\s*[-:：]\s*(.*))?$/i;
const scenePattern = /^#{1,4}\s*([0-9]+\s*[-－—]\s*[0-9]+)(?:\s+|[-:：])?(.*)$/;
const boldScenePattern = /^\*\*\s*场\s*[：:]?\s*(.*?)\s*\*\*$/;
const boldActionPattern = /^\*\*\s*(?:画面|动作|行动)\s*\*\*\s*[：:]\s*(.*)$/;
const cardPattern = /^【(一|二|三|四|五|六|七|八|九|十|[0-9]+)卡】\s*(.*)$/;
const voicePattern = /^(?:(VO|OS)\s*[0-9A-Za-z_-]*\s*[：:]\s*|\[?(VO|OS)\]?\s*[：:]\s*)(.*)$/i;
const speakerPattern = /^(?:\*\*)?([^：:\n]{1,40})(?:\*\*)?\s*[：:]\s*(.*)$/;

const chineseNumbers: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100,
};

function parseNumber(value: string): number | undefined {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === '十') return 10;
  if (value.length === 2 && value[0] === '十') return 10 + (chineseNumbers[value[1]] ?? 0);
  if (value.length === 2 && value[1] === '十') return (chineseNumbers[value[0]] ?? 0) * 10;
  if (value.length === 3 && value[1] === '十') {
    return (chineseNumbers[value[0]] ?? 0) * 10 + (chineseNumbers[value[2]] ?? 0);
  }
  return chineseNumbers[value];
}

function node(
  type: ParsedNodeType,
  raw: string,
  text: string,
  line: number,
  extra: Partial<ParsedNode> = {},
): ParsedNode {
  return { type, raw, text, location: { lineStart: line, lineEnd: line }, ...extra };
}

export function parseScreenplayMarkdown(source: string): ParsedScreenplay {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  const metadata: ParsedNode[] = [];
  const episodes: ParsedEpisode[] = [];
  const nodes: ParsedNode[] = [];
  const unknownNodes: ParsedNode[] = [];
  let currentEpisode: ParsedEpisode | undefined;
  let currentScene: ParsedNode | undefined;
  let activeMetadata: ParsedNode | undefined;

  const add = (parsed: ParsedNode): void => {
    if (parsed.type === 'metadata') metadata.push(parsed);
    else nodes.push(parsed);
    if (parsed.type === 'unknown') unknownNodes.push(parsed);
    if (currentEpisode) {
      parsed.episodeNumber = currentEpisode.number;
      if (parsed.type === 'scene') {
        currentEpisode.scenes.push(parsed);
        currentScene = parsed;
      }
      if (parsed.type !== 'scene' && currentScene?.sceneId) parsed.sceneId = currentScene.sceneId;
    }
  };

  for (const [index, raw] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const metadataMatch = /^#{1,3}\s*[【\[]?([^】\]]+)[】\]]?\s*$/.exec(trimmed);
    const metadataHeading = metadataMatch?.[1]?.trim();
    if (metadataHeading && metadataHeadings.has(metadataHeading)) {
      activeMetadata = node('metadata', raw, metadataHeading, lineNumber, { needsReview: false });
      add(activeMetadata);
      continue;
    }

    const episodeMatch = episodePattern.exec(trimmed) ?? alternateEpisodePattern.exec(trimmed);
    if (episodeMatch) {
      const episodeValue = episodeMatch[1];
      const episodeNumber = episodeValue ? parseNumber(episodeValue) : undefined;
      if (episodeNumber === undefined) {
        add(node('unknown', raw, trimmed, lineNumber, { needsReview: true }));
        currentEpisode = undefined;
      } else {
        currentEpisode = {
          number: episodeNumber,
          title: episodeMatch[2]?.trim() || undefined,
          location: { lineStart: lineNumber, lineEnd: lineNumber },
          scenes: [],
        };
        episodes.push(currentEpisode);
        currentScene = undefined;
        add(node('episode', raw, episodeMatch[2]?.trim() || `第${episodeNumber}集`, lineNumber, { episodeNumber }));
      }
      activeMetadata = undefined;
      continue;
    }

    const sceneMatch = scenePattern.exec(trimmed) ?? boldScenePattern.exec(trimmed);
    if (sceneMatch) {
      const sceneId = (sceneMatch[1] ?? '').trim() || `scene-${lineNumber}`;
      add(node('scene', raw, (sceneMatch[2] ?? sceneMatch[1] ?? '').trim(), lineNumber, { sceneId }));
      activeMetadata = undefined;
      continue;
    }

    const cardMatch = cardPattern.exec(trimmed);
    if (cardMatch) {
      add(node('card', raw, cardMatch[2]?.trim() ?? '', lineNumber));
      continue;
    }

    const voiceMatch = voicePattern.exec(trimmed);
    if (voiceMatch) {
      const kind = (voiceMatch[1] || voiceMatch[2] || '').toLowerCase() as 'vo' | 'os';
      add(node(kind, raw, voiceMatch[3]?.trim() ?? '', lineNumber, { speaker: kind.toUpperCase() }));
      continue;
    }

    // Metadata body lines belong to the active metadata block, even when they
    // contain a colon (for example `题材：古风悬疑`).
    if (activeMetadata) {
      add(node('metadata', raw, trimmed, lineNumber));
      continue;
    }

    const dialogueMatch = speakerPattern.exec(trimmed);
    if (dialogueMatch && !trimmed.startsWith('#')) {
      const speaker = (dialogueMatch[1] ?? '').replace(/^\*+|\*+$/g, '').trim();
      const text = (dialogueMatch[2] ?? '').replace(/\*+$/g, '').trim();
      if (/^(?:画面|动作|行动|行为)$/.test(speaker)) {
        add(node('action', raw, text, lineNumber));
        continue;
      }
      const type: ParsedNodeType = /内心|心声|独白/.test(speaker) ? 'inner-thought' : 'dialogue';
      add(node(type, raw, text, lineNumber, { speaker }));
      continue;
    }

    const boldActionMatch = boldActionPattern.exec(trimmed);
    if (boldActionMatch) {
      add(node('action', raw, (boldActionMatch[1] ?? '').trim(), lineNumber));
    } else if (/^(?:动作|动[作作]|画面|行为)\s*[：:]/.test(trimmed) || /^\（.*\）$/.test(trimmed)) {
      add(node('action', raw, trimmed.replace(/^[^：:]+[：:]/, '').trim(), lineNumber));
    } else {
      add(node('unknown', raw, trimmed, lineNumber, { needsReview: true }));
    }
  }

  return { metadata, episodes, nodes, unknownNodes };
}
