/** Builds what the wird widget shows from the database and settings (runs in the app or headless for the widget). */
import { Appearance } from "react-native";
import { arabicDigits, pageOf, surah } from "@/quran";
import { arabicPlural, initI18n, tr } from "@/i18n";
import { goalProgress } from "@/state/goal";
import { getSettings } from "@/state/settings";
import type { WirdWidgetData } from "./WirdWidget";

/** `width` is the widget's width in dp (from WidgetInfo). */
export function wirdWidgetData(width: number): WirdWidgetData {
  initI18n();
  const s = getSettings();
  const rtl = s.language === "ar";
  const num = (n: number) => (rtl ? arabicDigits(n) : String(n));
  const count = (key: string, n: number) => tr(`${key}_${rtl ? arabicPlural(n) : n === 1 ? "one" : "other"}`, { n: num(n) });
  const dark = s.theme === "dark" || (s.theme === "system" && Appearance.getColorScheme() === "dark");
  const sr = surah(s.wird.surah);
  const continueLine = `${tr("home.wirdFrom", { surah: rtl ? sr.ar : sr.en, ayah: num(s.wird.ayah) })} · ${tr("home.page", { n: num(pageOf(s.wird.surah, s.wird.ayah)) })}`;

  if (!s.goal) {
    return {
      title: tr("home.goalTitle"),
      progress: tr("home.setGoal"),
      ratio: 0,
      met: false,
      status: " ",
      continueLine,
      streak: null,
      dark,
      rtl,
      width,
    };
  }
  const p = goalProgress(s.goal);
  const done = p.unit === "pages" ? Math.floor(p.done * 10) / 10 : Math.floor(p.done);
  const left = Math.max(0, p.unit === "pages" ? Math.ceil((p.amount - p.done) * 10) / 10 : Math.ceil(p.amount - p.done));
  return {
    title: tr("home.goalTitle"),
    progress: `${num(done)} / ${count(`goal.${p.unit}`, p.amount)}`,
    ratio: p.done / p.amount,
    met: p.met,
    status: p.met ? tr("home.goalDone") : tr("home.goalLeft", { left: count(`goal.${p.unit}`, left) }),
    continueLine,
    streak: p.streak > 0 ? `🔥 ${num(p.streak)}` : null,
    dark,
    rtl,
    width,
  };
}
