export function sanitizeHref(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "https://chatgpt.com");
    if (["https:", "http:", "mailto:"].includes(url.protocol)) return url.href;
  } catch {
    return null;
  }
  return null;
}

export function normalizeProseWhitespace(value: string): string {
  return value.replace(/[\t\n\r ]+/g, " ");
}

export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}
