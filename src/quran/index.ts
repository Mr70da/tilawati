/**
 * The Quran text and mushaf metadata. Word lists come from Tilawa's `ref-v2` reference, so a word index on screen is
 * the same `{surah, ayah, word}` (1-based) the engine reports.
 */
import type { ReferenceAsset } from "@tilawa/core";
import { loadBundledReference } from "@/engine/bundled";
import juzData from "./data/juz.json";
import pagesData from "./data/pages.json";
import surahData from "./data/surahs.json";

export interface Surah {
  n: number;
  ar: string;
  en: string;
  ayahs: number;
  type: "meccan" | "medinan";
  page: number;
}
export interface Juz {
  n: number;
  s: number;
  a: number;
  page: number;
}
export interface AyahId {
  surah: number;
  ayah: number;
}

export const SURAHS = surahData as Surah[];
export const JUZ = juzData as Juz[];
/** `PAGES[n - 1]` is `[fromSurah, fromAyah, toSurah, toAyah]` of Madani page n. */
export const PAGES = pagesData as [number, number, number, number][];
export const PAGE_COUNT = PAGES.length;

export const surah = (n: number): Surah => SURAHS[n - 1];
const key = (s: number, a: number) => s * 1000 + a;

let words: Map<number, string[]> | null = null;
let ready: Promise<void> | null = null;

function index(ref: ReferenceAsset) {
  const m = new Map<number, string[]>();
  for (const a of ref.ayahs) m.set(key(a.s, a.a), a.w);
  words = m;
}

/** Resolves once the word lists are in memory. Safe to call many times. */
export function loadQuran(): Promise<void> {
  ready ??= loadBundledReference().then(index);
  return ready;
}

export function isQuranLoaded(): boolean {
  return words !== null;
}

export function ayahWords(s: number, a: number): string[] {
  return words?.get(key(s, a)) ?? [];
}

export function wordAt(s: number, a: number, w: number): string | undefined {
  return ayahWords(s, a)[w - 1];
}

/** Every ayah from `from` to `to` inclusive, crossing surah boundaries. */
export function ayahRange(from: AyahId, to: AyahId): AyahId[] {
  const out: AyahId[] = [];
  for (let s = from.surah; s <= to.surah; s++) {
    const first = s === from.surah ? from.ayah : 1;
    const last = s === to.surah ? to.ayah : surah(s).ayahs;
    for (let a = first; a <= last; a++) out.push({ surah: s, ayah: a });
  }
  return out;
}

export function pageAyahs(page: number): AyahId[] {
  const [fs, fa, ts, ta] = PAGES[page - 1];
  return ayahRange({ surah: fs, ayah: fa }, { surah: ts, ayah: ta });
}

export function pageOf(s: number, a: number): number {
  let lo = 0;
  let hi = PAGES.length - 1;
  const k = key(s, a);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const [ms, ma] = PAGES[mid];
    if (key(ms, ma) <= k) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

export function juzOf(s: number, a: number): number {
  const k = key(s, a);
  let j = 1;
  for (const z of JUZ) if (key(z.s, z.a) <= k) j = z.n;
  return j;
}

/** Arabic-Indic digits for ayah markers and Arabic UI. */
export function arabicDigits(n: number | string): string {
  return String(n)
    .replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)])
    .replace(/([٠-٩])\.([٠-٩])/g, "$1٫$2");
}

export const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
/** Al-Fatiha's first ayah is the basmala; At-Tawbah has none. */
export const showsBasmala = (s: number) => s !== 1 && s !== 9;
