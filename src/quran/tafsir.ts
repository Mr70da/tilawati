/**
 * Tafsir, downloaded one surah at a time from the quran.com API the first time it is opened and kept on the phone,
 * so a surah you've read once is available offline afterwards.
 */
import { Directory, File, Paths } from "expo-file-system";
import { plainText } from "./tafsirText";
import type { SurahTafsir } from "./tafsirText";

export { explanationFor } from "./tafsirText";
export type { SurahTafsir } from "./tafsirText";

export type TafsirId = "muyassar" | "saadi" | "ibn_kathir" | "ibn_kathir_en" | "maarif_en";

export interface Tafsir {
  id: TafsirId;
  /** quran.com resource id. */
  resource: number;
  ar: string;
  en: string;
  /** Short names for the chips on the tafsir screen. */
  arShort: string;
  enShort: string;
  lang: "ar" | "en";
}

export const TAFSIRS: Tafsir[] = [
  { id: "muyassar", resource: 16, ar: "التفسير الميسر", en: "Al-Muyassar", arShort: "الميسر", enShort: "Muyassar", lang: "ar" },
  { id: "saadi", resource: 91, ar: "تفسير السعدي", en: "As-Sa'di", arShort: "السعدي", enShort: "Sa'di", lang: "ar" },
  { id: "ibn_kathir", resource: 14, ar: "تفسير ابن كثير", en: "Ibn Kathir (Arabic)", arShort: "ابن كثير", enShort: "Ibn Kathir (AR)", lang: "ar" },
  {
    id: "ibn_kathir_en",
    resource: 169,
    ar: "ابن كثير (إنجليزي مختصر)",
    en: "Ibn Kathir (abridged)",
    arShort: "ابن كثير · إنجليزي",
    enShort: "Ibn Kathir (EN)",
    lang: "en",
  },
  {
    id: "maarif_en",
    resource: 168,
    ar: "معارف القرآن (إنجليزي)",
    en: "Ma'arif al-Qur'an",
    arShort: "معارف القرآن · إنجليزي",
    enShort: "Ma'arif (EN)",
    lang: "en",
  },
];

export const tafsirInfo = (id: TafsirId) => TAFSIRS.find((x) => x.id === id) ?? TAFSIRS[0];

function dir(t: Tafsir): Directory {
  const d = new Directory(Paths.document, "tafsir", t.id);
  d.create({ intermediates: true, idempotent: true });
  return d;
}

const memory = new Map<string, SurahTafsir>();
const inflight = new Map<string, Promise<SurahTafsir>>();

/** Tafsir of a whole surah, read from the phone or downloaded first. Rejects when offline and not downloaded yet. */
export function surahTafsir(id: TafsirId, surah: number): Promise<SurahTafsir> {
  const key = `${id}/${surah}`;
  const cached = memory.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(key);
  if (existing) return existing;
  const job = (async () => {
    const t = tafsirInfo(id);
    const file = new File(dir(t), `${surah}.json`);
    if (file.exists && file.size > 0) {
      try {
        const data = JSON.parse(await file.text()) as SurahTafsir;
        memory.set(key, data);
        return data;
      } catch {
        file.delete(); // a half-written file: download it again
      }
    }
    const res = await fetch(`https://api.quran.com/api/v4/tafsirs/${t.resource}/by_chapter/${surah}?per_page=300`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { tafsirs: { verse_key: string; text: string }[] };
    const data: SurahTafsir = {};
    for (const x of body.tafsirs) data[Number(x.verse_key.split(":")[1])] = plainText(x.text ?? "");
    if (Object.keys(data).length === 0) throw new Error("empty");
    await file.write(JSON.stringify(data));
    memory.set(key, data);
    return data;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

export function tafsirBytes(): number {
  const root = new Directory(Paths.document, "tafsir");
  if (!root.exists) return 0;
  let total = 0;
  const walk = (d: Directory) => {
    for (const x of d.list()) {
      if (x instanceof Directory) walk(x);
      else total += x.size ?? 0;
    }
  };
  walk(root);
  return total;
}

export function deleteTafsir() {
  memory.clear();
  const root = new Directory(Paths.document, "tafsir");
  if (root.exists) root.delete();
}
