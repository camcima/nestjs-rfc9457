/**
 * Converts an HTTP status phrase to a URL-safe kebab-case slug.
 * Scoped to ASCII HTTP reason phrases (e.g., "Not Found" -> "not-found").
 * Not intended as a general-purpose slugifier for arbitrary Unicode input.
 */
export function toSlug(phrase: string): string {
  return phrase
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
