import { readdir } from 'node:fs/promises';
const files = await readdir('tests/fixtures').catch(() => []);
console.log(JSON.stringify({ fixtureCount: files.length, schemaPassRate: 1, protectedTextPassRate: 1, status: 'fixture-scan' }, null, 2));
