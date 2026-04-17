const MAX_CHARS = 50_000;

export function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text;

  const truncated = text.slice(0, MAX_CHARS);
  return `${truncated}\n\n---\n**WARNING:** Output truncated at ${MAX_CHARS.toLocaleString()} characters. Use more specific queries to get complete results.`;
}
