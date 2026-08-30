import { describe, expect, it } from 'vitest';
import { redactSecrets } from '../../src/infrastructure/secret-store';
describe('secret redaction', () => { it('removes keys from logs and exports', () => { expect(redactSecrets('Bearer abc123 apiKey=secret', ['abc123', 'secret'])).not.toContain('abc123'); }); });
