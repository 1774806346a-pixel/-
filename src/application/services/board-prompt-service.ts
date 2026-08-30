import type { Asset, BoardPrompt } from '../../domain/models';
import { buildBoardPrompt, type BoardPromptOptions, validateBoardPrompt } from '../../domain/rules/board-prompt-rules';

export interface BoardPromptGenerationResult { prompts: BoardPrompt[]; errors: string[] }

export function generateBoardPrompts(assets: readonly Asset[], options: BoardPromptOptions = {}): BoardPromptGenerationResult {
  const prompts: BoardPrompt[] = [];
  const errors: string[] = [];
  assets.filter((asset) => !asset.deletedAt).forEach((asset) => {
    const prompt = buildBoardPrompt(asset, options);
    const validation = validateBoardPrompt(prompt);
    if (validation.length) errors.push(`${asset.name}: ${validation.join('；')}`); else prompts.push(prompt);
  });
  return { prompts, errors };
}

export class BoardPromptService {
  generate(assets: readonly Asset[], options?: BoardPromptOptions): BoardPromptGenerationResult { return generateBoardPrompts(assets, options); }
}
