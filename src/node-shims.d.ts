declare module 'node:crypto' {
  export function createHash(algorithm: string): {
    update(data: Uint8Array): { digest(encoding: 'hex'): string };
  };
}

declare module 'node:fs/promises' {
  export interface FileStats {
    size: number;
  }
  export function readFile(path: string): Promise<Uint8Array>;
  export function stat(path: string): Promise<FileStats>;
}

declare module 'node:path' {
  export function extname(path: string): string;
  export function basename(path: string): string;
}
