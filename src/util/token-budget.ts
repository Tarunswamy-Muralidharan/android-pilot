const MAX_OUTPUT_CHARS = 8000;

export function truncateOutput(text: string, maxChars: number = MAX_OUTPUT_CHARS): string {
  if (text.length <= maxChars) return text;
  const half = Math.floor((maxChars - 50) / 2);
  return (
    text.slice(0, half) +
    `\n\n... [truncated ${text.length - maxChars} chars] ...\n\n` +
    text.slice(-half)
  );
}

export function compactJson(obj: unknown, maxChars: number = MAX_OUTPUT_CHARS): string {
  const json = JSON.stringify(obj, null, 2);
  return truncateOutput(json, maxChars);
}
