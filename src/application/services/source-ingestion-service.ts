import { importSourceFile, type ImportOptions, type SourceFile } from '../../infrastructure/file-importer';
import { parseScreenplayMarkdown, type ParsedScreenplay } from './screenplay-parser';
import { buildSourceVoiceLedger, type SourceVoiceLedgerEntry } from './source-voice-ledger';
import { SourceAnalysisService, type SourceAnalysisResult } from './source-analysis-service';

export interface IngestedSource {
  source: SourceFile;
  parsed: ParsedScreenplay;
  voiceLedger: SourceVoiceLedgerEntry[];
  needsReview: boolean;
  reviewLocations: number[];
}

export async function ingestSourceFile(filePath: string, options?: ImportOptions): Promise<IngestedSource> {
  const source = await importSourceFile(filePath, options);
  return ingestSourceText(source, source.text);
}

export function ingestSourceText(source: SourceFile, text = source.text): IngestedSource {
  const parsed = parseScreenplayMarkdown(text);
  const voiceLedger = buildSourceVoiceLedger(parsed.nodes);
  const reviewLocations = parsed.unknownNodes.map((item) => item.location.lineStart);
  return {
    source: { ...source, text, characterCount: [...text].length },
    parsed,
    voiceLedger,
    needsReview: reviewLocations.length > 0,
    reviewLocations,
  };
}

/** Runs the shared source-analysis flow while retaining the immutable imported source. */
export async function analyzeIngestedSource(result: IngestedSource, options: { adapter?: import('../model/model-adapter').ModelAdapter; signal?: AbortSignal } = {}): Promise<SourceAnalysisResult> {
  return new SourceAnalysisService().analyze({ input: result.source.text, inputType: 'screenplay', ...options });
}
