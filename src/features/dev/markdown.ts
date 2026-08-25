/**
 * The document's prose, with its markdown taken off.
 *
 * The descriptions are markdown because that is what an OpenAPI description is,
 * and every reader on the other end — Scalar, Swagger UI, a generated client's
 * doc comments — renders it. This panel is the one reader that does not, and a
 * dependency on a markdown renderer to show three asterisks correctly is a poor
 * trade. The emphasis marks come off; the words and the line breaks stay.
 */
export function plain(markdown: string): string {
  return markdown.replaceAll('**', '').replaceAll('`', '');
}

/**
 * A path as the index shows it, without the prefix every path shares.
 *
 * The column is narrow and `/api/v1/` is eight characters of it that never
 * distinguish one entry from another; dropping them is what lets the rest fit
 * on one line instead of breaking a `{slug}` in half. The cards below, which
 * are what someone copies from, still show the whole path.
 */
export function shortPath(path: string): string {
  return path.replace(/^\/api\/v\d+/, '') || path;
}
