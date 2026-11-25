/**
 * Wird position arithmetic: where in the Quran the daily wird continues from. Pure (the surah ayah counts are passed
 * in), so it runs under the unit tests.
 */

export interface AyahPos {
  surah: number;
  ayah: number;
}

/** Position of an ayah in the whole Quran, from 0. `counts[i]` is the ayah count of surah i + 1. */
export function ordinal(counts: number[], p: AyahPos): number {
  let n = 0;
  for (let s = 1; s < p.surah; s++) n += counts[s - 1];
  return n + p.ayah - 1;
}

/** The ayah after `p`, or null after the last ayah of the Quran. */
export function nextAyah(counts: number[], p: AyahPos): AyahPos | null {
  if (p.ayah < counts[p.surah - 1]) return { surah: p.surah, ayah: p.ayah + 1 };
  if (p.surah < counts.length) return { surah: p.surah + 1, ayah: 1 };
  return null;
}

/**
 * Where the wird continues after a session that recited `recited` ("s:a" ids). It moves to just after the furthest
 * ayah recited at or beyond the current position, so revising earlier ayahs never moves it back. `finished` is true
 * when that passes the end of the Quran (a khatma), and the position starts again at Al-Fatiha.
 */
export function advance(counts: number[], pos: AyahPos, recited: string[]): { pos: AyahPos; finished: boolean } {
  const start = ordinal(counts, pos);
  let best: AyahPos | null = null;
  let bestN = -1;
  for (const id of recited) {
    const [surah, ayah] = id.split(":").map(Number);
    if (!surah || !ayah) continue;
    const n = ordinal(counts, { surah, ayah });
    if (n >= start && n > bestN) {
      bestN = n;
      best = { surah, ayah };
    }
  }
  if (!best) return { pos, finished: false };
  const next = nextAyah(counts, best);
  return next ? { pos: next, finished: false } : { pos: { surah: 1, ayah: 1 }, finished: true };
}
