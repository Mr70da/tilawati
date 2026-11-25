import { useColorScheme } from "react-native";
import { useSettings } from "@/state/settings";

export const palette = {
  light: {
    bg: "#F7F3EA",
    surface: "#FFFFFF",
    surfaceAlt: "#EFE9DC",
    paper: "#FFFDF7",
    text: "#1A2420",
    textMuted: "#66706B",
    textFaint: "#A3AAA5",
    border: "#E5DECF",
    primary: "#0F5D46",
    primaryPressed: "#0B4A38",
    onPrimary: "#FFFFFF",
    primarySoft: "#DDEDE5",
    gold: "#B08236",
    goldSoft: "#F4E7CD",
    danger: "#C0392B",
    dangerSoft: "#F9E1DC",
    warn: "#B7791F",
    warnSoft: "#FBEFD6",
    recited: "#0F5D46",
    pending: "#1A2420",
    hidden: "#CFC6B4",
    /** Faded hifz words: the text color at low alpha (works on Android text spans, unlike opacity). */
    ghost: "rgba(26, 36, 32, 0.13)",
    shadow: "rgba(26, 36, 32, 0.08)",
  },
  dark: {
    bg: "#0A1A16",
    surface: "#11251F",
    surfaceAlt: "#183128",
    paper: "#0F211C",
    text: "#ECF1EC",
    textMuted: "#9AAEA5",
    textFaint: "#5C716A",
    border: "#1F3B33",
    primary: "#3DBE8B",
    primaryPressed: "#32A578",
    onPrimary: "#05140F",
    primarySoft: "#173D31",
    gold: "#D9B26A",
    goldSoft: "#3A3220",
    danger: "#F27B66",
    dangerSoft: "#3E1F1A",
    warn: "#F2B64E",
    warnSoft: "#3B2F15",
    recited: "#5FD3A3",
    pending: "#ECF1EC",
    hidden: "#2C4A42",
    ghost: "rgba(236, 241, 236, 0.13)",
    shadow: "rgba(0, 0, 0, 0.4)",
  },
};

export type Colors = typeof palette.light;

export const fonts = {
  quran: "AmiriQuran_400Regular",
  regular: "IBMPlexSansArabic_400Regular",
  medium: "IBMPlexSansArabic_500Medium",
  semibold: "IBMPlexSansArabic_600SemiBold",
  bold: "IBMPlexSansArabic_700Bold",
};

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };
export const space = (n: number) => n * 8;

export function useTheme() {
  const system = useColorScheme();
  const { theme } = useSettings();
  const dark = theme === "system" ? system === "dark" : theme === "dark";
  return { dark, c: dark ? palette.dark : palette.light };
}
