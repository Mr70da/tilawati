/** Pure helpers for tafsir text (no native imports, so they run under the unit tests). */

/** One surah of a tafsir: the explanation of each ayah, `""` where the ayah is explained together with earlier ones. */
export type SurahTafsir = Record<number, string>;

/** Turns the API's light HTML into plain paragraphs. Exported for tests. */
export function plainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|h\d|div|li)\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The text that explains ayah `a`, and the range of ayahs it covers. Some tafsirs explain several ayahs in one
 * passage, attached to the first of them; the ayahs after it come back empty.
 */
export function explanationFor(data: SurahTafsir, a: number): { text: string; from: number; to: number } | null {
  let from = a;
  while (from > 1 && !data[from]) from--;
  const text = data[from];
  if (!text) return null;
  let to = from;
  while (data[to + 1] === "") to++;
  return { text, from, to };
}
