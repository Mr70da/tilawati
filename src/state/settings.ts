/** App settings, persisted in SQLite and shared through a tiny external store. */
import { useSyncExternalStore } from "react";
import { kvGet, kvSet } from "@/db";
import type { ReciterId } from "@/audio/ayahAudio";
import type { TierChoice } from "@/engine/bundled";
import type { TafsirId } from "@/quran/tafsir";
import type { Goal } from "@/state/goal";
import type { AyahPos } from "@/state/wirdMath";

export type Language = "ar" | "en";
export type ThemePref = "system" | "light" | "dark";

export interface Settings {
  /** Arabic by default; English only once the user picks it in Settings. */
  language: Language;
  /** True once the user has picked a language themselves. */
  languageChosen: boolean;
  theme: ThemePref;
  tier: TierChoice;
  /** When a suspected mistake becomes confirmed: after a short delay, or once the next word starts. */
  confirm: "delay" | "next-word";
  countSelfCorrections: boolean;
  haptics: boolean;
  /** Quran text size in points. */
  fontSize: number;
  /** Hifz test: hide upcoming words completely, or show them blurred. */
  hifzHide: "hidden" | "blur";
  /** Listen & repeat: whose recitation plays, and how many times each ayah plays before your turn. */
  reciter: ReciterId;
  learnRepeat: 1 | 2 | 3;
  /** Daily goal (null = off), and the reminder that nudges you toward it. */
  goal: Goal | null;
  reminder: boolean;
  reminderHour: number;
  reminderMinute: number;
  /** The next ayah of the daily wird, and how many times the wird has gone through the whole Quran. */
  wird: AyahPos;
  khatmas: number;
  /** Which tafsir the tafsir screen opens with. */
  tafsir: TafsirId;
  /** Last page opened in the Mushaf tab. */
  lastPage: number;
  onboarded: boolean;
}

const DEFAULTS: Settings = {
  language: "ar",
  languageChosen: false,
  theme: "system",
  tier: "auto",
  confirm: "delay",
  countSelfCorrections: false,
  haptics: true,
  fontSize: 26,
  hifzHide: "hidden",
  reciter: "husary_muallim",
  learnRepeat: 1,
  goal: { unit: "pages", amount: 1 },
  reminder: false,
  reminderHour: 20,
  reminderMinute: 0,
  tafsir: "muyassar",
  wird: { surah: 1, ayah: 1 },
  khatmas: 0,
  lastPage: 1,
  onboarded: false,
};

let settings: Settings | null = null;
const listeners = new Set<() => void>();

function load(): Settings {
  if (settings) return settings;
  const raw = kvGet("settings");
  const saved = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
  settings = { ...DEFAULTS, ...saved };
  // Earlier versions saved the device language without the user choosing it: Arabic is the primary language.
  if (!settings.languageChosen) settings.language = "ar";
  return settings;
}

export function getSettings(): Settings {
  return load();
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...load(), ...patch };
  kvSet("settings", JSON.stringify(settings));
  for (const l of listeners) l();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, load, load);
}
