import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { importSourceBytes } from '../../src/infrastructure/file-importer';
import { ingestSourceFile } from '../../src/application/services/source-ingestion-service';

describe('source ingestion', () => {
  it('imports the fixture, parses screenplay nodes, and builds a voice ledger', async () => {
    const result = await ingestSourceFile(resolve(process.cwd(), 'tests/fixtures/source-dialogue.md'));
    expect(result.source.encoding).toBe('utf-8');
    expect(result.source.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.parsed.episodes[0]?.number).toBe(1);
    expect(result.parsed.episodes[0]?.scenes[0]?.sceneId).toBe('1-1');
    expect(result.voiceLedger.map((entry) => entry.text)).toEqual([
      '你终于来了。',
      '我不能让你一个人进去。',
      '城门后的秘密，今夜将被揭开。',
      '她说谎了。',
    ]);
    expect(result.needsReview).toBe(true);
    expect(result.reviewLocations.length).toBeGreaterThan(0);
  });

  it('refuses malformed UTF-8 unless explicitly confirmed', async () => {
    const bytes = new Uint8Array([0xc3, 0x28]);
    await expect(importSourceBytes('bad.txt', bytes)).rejects.toMatchObject({ code: 'invalid-encoding' });
    const imported = await importSourceBytes('bad.txt', bytes, { confirmNonUtf8: () => true });
    expect(imported.encoding).toBe('utf-8-with-replacement');
    expect(imported.requiresEncodingConfirmation).toBe(true);
  });

  it('keeps the original text and rejects files over 10 MB', async () => {
    const file = resolve(process.cwd(), 'tests/fixtures/source-dialogue.md');
    const original = (await readFile(file)).toString('utf8');
    const result = await ingestSourceFile(file);
    expect(result.source.text).toBe(original);
    await expect(importSourceBytes('large.txt', new Uint8Array(11 * 1024 * 1024))).rejects.toMatchObject({ code: 'file-too-large' });
  });
});
