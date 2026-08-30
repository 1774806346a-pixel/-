/** Parses model output that may contain a fenced JSON block or short prose around JSON. */
export function parseModelJson(text: string): unknown {
  const source = text.trim();
  const candidates = [source, source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim(), extractBalanced(source, "{", "}"), extractBalanced(source, "[", "]")].filter((candidate): candidate is string => Boolean(candidate));
  let lastError: unknown;
  for (const candidate of candidates) { try { return JSON.parse(candidate); } catch (error) { lastError = error; } }
  throw lastError instanceof Error ? lastError : new SyntaxError("Model output is not valid JSON");
}
function extractBalanced(source: string, open: string, close: string): string | undefined {
  const start = source.indexOf(open); if (start < 0) return undefined;
  let depth = 0; let quoted = false; let escaped = false;
  for (let index = start; index < source.length; index += 1) { const char = source[index]; if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; } if (char === '"') quoted = true; else if (char === open) depth += 1; else if (char === close && --depth === 0) return source.slice(start, index + 1); }
  return undefined;
}
