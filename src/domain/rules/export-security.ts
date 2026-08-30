import { redactSecrets } from '../../infrastructure/secret-store';
export function sanitizeExport(value: string, secrets: readonly string[] = []): string { return redactSecrets(value, secrets); }
