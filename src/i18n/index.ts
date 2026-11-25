import { createInstance } from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { getSettings, useSettings } from "@/state/settings";
import type { Language } from "@/state/settings";
import { arabicDigits } from "@/quran";
import { ar, en } from "./strings";

const i18n = createInstance();
let initialized = false;

export function initI18n() {
  if (initialized) return;
  initialized = true;
  i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: getSettings().language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

/** CLDR plural category for Arabic. */
export function arabicPlural(n: number): "zero" | "one" | "two" | "few" | "many" | "other" {
  const m = n % 100;
  if (n === 0) return "zero";
  if (n === 1) return "one";
  if (n === 2) return "two";
  if (m >= 3 && m <= 10) return "few";
  if (m >= 11 && m <= 99) return "many";
  return "other";
}

/** Translate outside React (notifications). */
export const tr = (key: string, opts: Record<string, unknown> = {}) => i18n.t(key, opts) as string;

export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang);
}

/**
 * Translation plus layout direction. The app lays itself out with an explicit `direction` style instead of
 * `I18nManager.forceRTL`, so switching language takes effect at once, with no restart.
 */
export function useI18n() {
  const { t } = useTranslation();
  const { language } = useSettings();
  const rtl = language === "ar";
  const num = (n: number | string) => (rtl ? arabicDigits(n) : String(n));
  return {
    t,
    lang: language,
    rtl,
    num,
    /**
     * Start-of-line text alignment. Inside a `direction: "rtl"` subtree React Native on Android treats
     * `textAlign: "left"` as the start edge (it swaps left and right), so "left" is right-aligned in Arabic.
     */
    align: "left" as const,
    dir: (rtl ? "rtl" : "ltr") as "rtl" | "ltr",
    /**
     * A counted phrase ("3 ayahs", "٣ آيات") with the number in the UI's digits. Arabic plural forms are chosen here
     * because Hermes on Android doesn't give i18next the CLDR plural rules.
     */
    tc: (key: string, count: number) => t(`${key}_${rtl ? arabicPlural(count) : count === 1 ? "one" : "other"}`, { n: num(count) }),
    /** Flip a chevron/arrow icon name for RTL. */
    flip: <T extends string>(ltrName: T, rtlName: T) => (rtl ? rtlName : ltrName),
  };
}
