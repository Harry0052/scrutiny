export function sanitizeExtractedText(input: string): string {
  const normalized = input
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.slice(0, 20000);
}

export function sanitizeUrl(input?: string | null): string | undefined {
  if (!input) {
    return undefined;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    return url.toString();
  } catch {
    return undefined;
  }
}
