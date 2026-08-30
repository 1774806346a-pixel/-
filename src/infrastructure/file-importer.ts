import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, basename } from 'node:path';

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export type SourceEncoding = 'utf-8' | 'utf-8-with-replacement' | 'unknown';

export interface SourceFile {
  fileName: string;
  path?: string;
  bytes: number;
  hash: string;
  text: string;
  characterCount: number;
  encoding: SourceEncoding;
  requiresEncodingConfirmation: boolean;
}

export interface ImportOptions {
  /** Called only when the byte sequence is not valid UTF-8. */
  confirmNonUtf8?: (fileName: string) => boolean | Promise<boolean>;
  maxBytes?: number;
}

export class SourceImportError extends Error {
  readonly code: 'unsupported-extension' | 'file-too-large' | 'invalid-encoding' | 'read-failed';
  readonly details?: Record<string, string | number>;

  constructor(
    code: SourceImportError['code'],
    message: string,
    details?: Record<string, string | number>,
  ) {
    super(message);
    this.name = 'SourceImportError';
    this.code = code;
    this.details = details;
  }
}

export function validateSourceFilename(fileName: string): void {
  const extension = extname(fileName).toLowerCase();
  if (extension !== '.txt' && extension !== '.md') {
    throw new SourceImportError(
      'unsupported-extension',
      `仅支持 .txt 和 .md 文件：${basename(fileName)}`,
      { fileName },
    );
  }
}

function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Decode bytes without silently replacing malformed UTF-8. */
export async function importSourceBytes(
  fileName: string,
  input: Uint8Array | ArrayBuffer,
  options: ImportOptions = {},
): Promise<SourceFile> {
  validateSourceFilename(fileName);
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const maxBytes = options.maxBytes ?? MAX_SOURCE_BYTES;
  if (bytes.byteLength > maxBytes) {
    throw new SourceImportError(
      'file-too-large',
      `文件超过 ${Math.round(maxBytes / 1024 / 1024)} MB 限制`,
      { fileName, bytes: bytes.byteLength, maxBytes },
    );
  }

  const digest = hashBytes(bytes);
  let text: string;
  let encoding: SourceEncoding = 'utf-8';
  let requiresEncodingConfirmation = false;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    requiresEncodingConfirmation = true;
    const confirmed = await options.confirmNonUtf8?.(fileName);
    if (!confirmed) {
      throw new SourceImportError(
        'invalid-encoding',
        '文件不是有效的 UTF-8 编码，请确认后再导入。',
        { fileName },
      );
    }
    // The replacement is explicit and only happens after user confirmation.
    text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    encoding = 'utf-8-with-replacement';
  }

  return {
    fileName,
    bytes: bytes.byteLength,
    hash: digest,
    text,
    characterCount: [...text].length,
    encoding,
    requiresEncodingConfirmation,
  };
}

export async function importSourceFile(
  filePath: string,
  options: ImportOptions = {},
): Promise<SourceFile> {
  validateSourceFilename(filePath);
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch (error) {
    throw new SourceImportError('read-failed', `无法读取文件：${filePath}`, {
      fileName: basename(filePath),
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  const maxBytes = options.maxBytes ?? MAX_SOURCE_BYTES;
  if (fileStats.size > maxBytes) {
    throw new SourceImportError(
      'file-too-large',
      `文件超过 ${Math.round(maxBytes / 1024 / 1024)} MB 限制`,
      { fileName: basename(filePath), bytes: fileStats.size, maxBytes },
    );
  }
  try {
    const imported = await importSourceBytes(basename(filePath), await readFile(filePath), options);
    return { ...imported, path: filePath };
  } catch (error) {
    if (error instanceof SourceImportError) throw error;
    throw new SourceImportError('read-failed', `无法读取文件：${filePath}`, {
      fileName: basename(filePath),
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
