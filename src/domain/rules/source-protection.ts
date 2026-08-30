import { compareProtectedText, type ProtectedTextComparison, type SourceVoiceLedgerEntry } from '../../application/services/source-voice-ledger';

export interface LockedSourceFact {
  id: string;
  value: string;
  category?: 'person' | 'relationship' | 'world' | 'timeline' | 'plot' | 'location' | 'prop';
  sourceLocation?: string;
  locked: boolean;
}

export interface SourceProtectionResult extends ProtectedTextComparison {
  missingFacts: LockedSourceFact[];
  addedFacts: string[];
}

export function validateSourceProtection(
  beforeVoice: readonly SourceVoiceLedgerEntry[] | readonly string[],
  afterVoice: readonly SourceVoiceLedgerEntry[] | readonly string[],
  lockedFacts: readonly LockedSourceFact[] = [],
  afterFacts: readonly string[] = [],
): SourceProtectionResult {
  const voice = compareProtectedText(beforeVoice, afterVoice);
  const activeFacts = lockedFacts.filter((fact) => fact.locked);
  const missingFacts = activeFacts.filter((fact) => !afterFacts.includes(fact.value));
  const knownFacts = new Set(activeFacts.map((fact) => fact.value));
  const addedFacts = afterFacts.filter((fact) => !knownFacts.has(fact));
  const result: SourceProtectionResult = { ...voice, missingFacts, addedFacts };
  if (missingFacts.length) {
    result.valid = false;
    result.errors = [...result.errors, '锁定的人物、关系、世界观或剧情事实被删除'];
  }
  return result;
}

export { compareProtectedText };
