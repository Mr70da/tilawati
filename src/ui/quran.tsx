/** Quran text rendering: ayahs as wrapped runs of tappable words, surah headers, and the basmala. */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "@/i18n";
import { arabicDigits, ayahWords, BASMALA, surah } from "@/quran";
import type { WordStatus } from "@/engine/recitation";
import { fonts, radius, space, useTheme } from "./theme";
import type { Colors } from "./theme";

export type HideMode = "none" | "hidden" | "blur";

function wordStyle(status: WordStatus, c: Colors, hide: HideMode) {
  switch (status) {
    case "confirmed":
      return { color: c.danger, backgroundColor: c.dangerSoft };
    case "suspected":
      return { color: c.warn, backgroundColor: c.warnSoft };
    case "current":
      return { color: c.recited, backgroundColor: c.goldSoft, textDecorationLine: "underline" as const, textDecorationColor: c.gold };
    case "recited":
      return { color: c.recited };
    case "hint":
      return { color: c.gold, backgroundColor: c.goldSoft };
    default:
      // Android ignores `opacity` and a fully transparent `color` on nested Text spans, so hiding works by
      // replacing the word (see `placeholder`) and fading uses a color with its own alpha.
      if (hide === "hidden") return { color: c.hidden };
      if (hide === "blur") return { color: c.ghost };
      return { color: c.pending };
  }
}

const ARABIC_LETTER = /[\u0621-\u064A\u0671-\u06D3]/g;

/** A tatweel bar roughly as wide as the word, so a hidden word reveals nothing but keeps the line layout. */
function placeholder(word: string): string {
  const letters = word.match(ARABIC_LETTER)?.length ?? 2;
  return "ـ".repeat(Math.max(3, Math.round(letters * 1.6)));
}

export interface AyahBlockProps {
  surah: number;
  ayah: number;
  fontSize: number;
  /** Word statuses joined by "," (1 entry per word); absent → plain reading. */
  statuses?: string;
  hide?: HideMode;
  highlight?: boolean;
  onWordPress?: (word: number) => void;
  onLongPress?: () => void;
}

/** One ayah as a single wrapped Text (proper Arabic shaping and line breaking), with a nested Text per word. */
export const AyahBlock = memo(function AyahBlock({
  surah: s,
  ayah: a,
  fontSize,
  statuses,
  hide = "none",
  highlight,
  onWordPress,
  onLongPress,
}: AyahBlockProps) {
  const { c } = useTheme();
  const words = ayahWords(s, a);
  const st = statuses ? (statuses.split(",") as WordStatus[]) : null;
  return (
    <Text
      onLongPress={onLongPress}
      suppressHighlighting
      style={[
        styles.ayah,
        { fontSize, lineHeight: fontSize * 2.05, color: c.text },
        highlight && { backgroundColor: c.primarySoft, borderRadius: radius.sm },
      ]}
    >
      {words.map((w, i) => {
        const status = st?.[i] ?? "pending";
        const mode = st ? hide : "none";
        return (
          <Text key={i} onPress={onWordPress ? () => onWordPress(i + 1) : undefined} style={wordStyle(status, c, mode)}>
            {status === "pending" && mode === "hidden" ? placeholder(w) : w}
            {i < words.length - 1 ? " " : ""}
          </Text>
        );
      })}
      <Text style={{ color: c.gold, fontSize: fontSize * 0.9 }}>{` ﴿${arabicDigits(a)}﴾ `}</Text>
    </Text>
  );
});

/** Ornamental surah title band with its number, revelation place and ayah count. */
export function SurahHeader({ n, compact }: { n: number; compact?: boolean }) {
  const { c } = useTheme();
  const { t, num, lang } = useI18n();
  const meta = surah(n);
  return (
    <View style={{ marginTop: space(compact ? 1 : 2), marginBottom: space(1) }}>
      <View style={[styles.band, { borderColor: c.gold, backgroundColor: c.goldSoft }]}>
        <View style={[styles.bandDiamond, { borderColor: c.gold, backgroundColor: c.paper }]}>
          <Text style={{ color: c.gold, fontFamily: fonts.semibold, fontSize: 12 }}>{num(n)}</Text>
        </View>
        <Text style={[styles.bandTitle, { color: c.text }]}>سُورَةُ {meta.ar}</Text>
        <View style={[styles.bandDiamond, { borderColor: c.gold, backgroundColor: c.paper }]}>
          <Text style={{ color: c.gold, fontFamily: fonts.semibold, fontSize: 12 }}>{num(meta.ayahs)}</Text>
        </View>
      </View>
      {!compact && (
        <Text style={{ textAlign: "center", color: c.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 6 }}>
          {lang === "ar" ? "" : `${meta.en} · `}
          {t(meta.type === "meccan" ? "mushaf.meccan" : "mushaf.medinan")}
        </Text>
      )}
    </View>
  );
}

export function Basmala({ fontSize }: { fontSize: number }) {
  const { c } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.quran,
        fontSize: fontSize * 0.95,
        lineHeight: fontSize * 2,
        color: c.text,
        textAlign: "center",
        writingDirection: "rtl",
      }}
    >
      {BASMALA}
    </Text>
  );
}

const styles = StyleSheet.create({
  ayah: { fontFamily: fonts.quran, textAlign: "justify", writingDirection: "rtl", paddingHorizontal: 4 },
  band: {
    flexDirection: "row",
    direction: "rtl",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    height: 52,
  },
  bandDiamond: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  bandTitle: { fontFamily: fonts.quran, fontSize: 22, lineHeight: 44, writingDirection: "rtl" },
});
