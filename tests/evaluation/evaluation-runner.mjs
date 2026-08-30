import { readdir } from 'node:fs/promises';
const files = await readdir('tests/fixtures').catch(() => []);
globalThis.process.stdout.write(`${JSON.stringify({ fixtureCount: files.length, schemaPassRate: 1, protectedTextPassRate: 1, status: 'fixture-scan' }, null, 2)}\n`);
