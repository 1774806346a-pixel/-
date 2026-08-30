import type { ParsedNode } from './screenplay-parser';

export type SourceVoiceType = 'dialogue' | 'inner-thought' | 'vo' | 'os';

export interface SourceVoiceLedgerEntry {
  id: string;
  sequence: number;
  text: string;
  sourceLocation: { lineStart: number; lineEnd: number };
  speaker?: string;
  type: SourceVoiceType;
  allowSplit: boolean;
}

export interface ProtectedTextComparison {
  valid: boolean;
  splitOnly: boolean;
  missing: string[];
  changed: string[];
  merged: string[];
  reordered: boolean;
  errors: string[];
}

function isVoiceNode(node: ParsedNode): node is ParsedNode & { type: SourceVoiceType } {
  return node.type === 'dialogue' || node.type === 'inner-thought' || node.type === 'vo' || node.type === 'os';
}

export function buildSourceVoiceLedger(nodes: readonly ParsedNode[]): SourceVoiceLedgerEntry[] {
  return nodes.filter(isVoiceNode).map((item, index) => ({
    id: `voice-${index + 1}`,
    sequence: index + 1,
    text: item.text,
    sourceLocation: item.location,
    speaker: item.speaker,
    type: item.type,
    allowSplit: true,
  }));
}

function texts(input: readonly SourceVoiceLedgerEntry[] | readonly string[]): string[] {
  return input.map((item) => typeof item === 'string' ? item : item.text);
}

/**
 * Compares protected voice text byte-for-byte. A source line may be split into
 * contiguous pieces, but pieces may not be deleted, rewritten, merged, or reordered.
 */
export function compareProtectedText(
  before: readonly SourceVoiceLedgerEntry[] | readonly string[],
  after: readonly SourceVoiceLedgerEntry[] | readonly string[],
): ProtectedTextComparison {
  const expected = texts(before);
  const actual = texts(after);
  const result: ProtectedTextComparison = {
    valid: true,
    splitOnly: false,
    missing: [],
    changed: [],
    merged: [],
    reordered: false,
    errors: [],
  };
  let sourceIndex = 0;
  let offset = 0;
  let previousSourceIndex = -1;

  for (const piece of actual) {
    if (sourceIndex >= expected.length) {
      result.changed.push(piece);
      continue;
    }
    if (!piece) {
      result.changed.push(piece);
      continue;
    }
    const current = expected[sourceIndex] ?? '';
    const remaining = current.slice(offset);
    if (piece.length > remaining.length) {
      result.merged.push(piece);
      result.valid = false;
      continue;
    }
    if (!remaining.startsWith(piece)) {
      const laterIndex = expected.findIndex((value, index) => index > sourceIndex && value.startsWith(piece));
      if (laterIndex >= 0) result.reordered = true;
      result.changed.push(piece);
      result.valid = false;
      continue;
    }
    if (sourceIndex !== previousSourceIndex && previousSourceIndex >= 0 && sourceIndex < previousSourceIndex) {
      result.reordered = true;
      result.valid = false;
    }
    previousSourceIndex = sourceIndex;
    offset += piece.length;
    if (offset === current.length) {
      sourceIndex += 1;
      offset = 0;
    } else {
      result.splitOnly = true;
    }
  }
  if (sourceIndex < expected.length) {
    result.missing.push(...expected.slice(sourceIndex).map((text) => text.slice(offset)));
    result.valid = false;
  }
  if (result.changed.length || result.merged.length || result.reordered || result.missing.length) result.valid = false;
  if (!result.valid) {
    result.errors = [
      ...(result.missing.length ? ['原文对白/独白存在删除或缺失'] : []),
      ...(result.changed.length ? ['原文对白/独白被改写或规范化'] : []),
      ...(result.merged.length ? ['多个原文语音片段被合并'] : []),
      ...(result.reordered ? ['原文语音片段顺序发生变化'] : []),
    ];
  }
  return result;
}
