/**
 * The daily wird continues where the last one stopped, so reciting it day after day goes through the whole Quran.
 */
import { PAGES, pageOf, SURAHS } from "@/quran";
import type { Goal } from "@/state/goal";
import { getSettings, updateSettings } from "@/state/settings";
import { advance, ordinal } from "@/state/wirdMath";
import type { AyahPos } from "@/state/wirdMath";

const COUNTS = SURAHS.map((s) => s.ayahs);
export const TOTAL_AYAHS = COUNTS.reduce((a, b) => a + b, 0);

/** Share of the Quran before the wird position, 0–1. */
export const khatmaProgress = (pos: AyahPos) => ordinal(COUNTS, pos) / TOTAL_AYAHS;

/**
 * Today's wird passage, starting at the wird position: enough to finish what's left of today's goal (a whole
 * goal's worth once it is met), stopping at the end of the surah since a passage stays within one surah.
 */
export function wirdPassage(pos: AyahPos, goal: Goal | null, left: number): { surah: number; from: number; to: number } {
  const last = COUNTS[pos.surah - 1];
  const want = goal ? (left > 0 ? left : goal.amount) : 1;
  let to: number;
  if (goal?.unit === "ayahs") to = pos.ayah + Math.ceil(want) - 1;
  else {
    // Pages, and minutes (a page at a time): through the end of the page where the passage would finish.
    const pages = goal?.unit === "pages" ? Math.max(1, Math.ceil(want)) : 1;
    const endPage = Math.min(PAGES.length, pageOf(pos.surah, pos.ayah) + pages - 1);
    const [, , ts, ta] = PAGES[endPage - 1];
    to = ts > pos.surah ? last : ta;
  }
  return { surah: pos.surah, from: pos.ayah, to: Math.max(pos.ayah, Math.min(last, to)) };
}

/** Moves the wird past a finished wird session's ayahs. */
export function advanceWird(recited: string[]) {
  const { wird, khatmas } = getSettings();
  const r = advance(COUNTS, wird, recited);
  if (r.pos.surah === wird.surah && r.pos.ayah === wird.ayah && !r.finished) return;
  updateSettings({ wird: r.pos, khatmas: khatmas + (r.finished ? 1 : 0) });
}

export function setWird(pos: AyahPos) {
  updateSettings({ wird: pos });
}
