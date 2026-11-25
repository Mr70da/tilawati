import { View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SessionRecord } from "@/db";
import { useI18n } from "@/i18n";
import { surah } from "@/quran";
import { Card, Row, T } from "./kit";
import { radius, space, useTheme } from "./theme";

export function formatDuration(ms: number, num: (n: number | string) => string) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return num(`${m}:${String(s).padStart(2, "0")}`);
}

export function sessionTitle(s: SessionRecord, lang: string) {
  const first = s.surah ?? (s.ayahs[0] ? Number(s.ayahs[0].split(":")[0]) : null);
  if (!first) return "—";
  const meta = surah(first);
  return lang === "ar" ? `سورة ${meta.ar}` : meta.en;
}

export function sessionRange(s: SessionRecord, num: (n: number | string) => string) {
  if (s.fromAyah && s.toAyah) return `${num(s.fromAyah)}–${num(s.toAyah)}`;
  if (s.ayahs.length) {
    const a = s.ayahs[0].split(":")[1];
    const b = s.ayahs[s.ayahs.length - 1].split(":")[1];
    return a === b ? num(a) : `${num(a)}–${num(b)}`;
  }
  return "";
}

export function SessionRow({ s }: { s: SessionRecord }) {
  const router = useRouter();
  const { c } = useTheme();
  const { t, num, lang, flip } = useI18n();
  const date = new Date(s.startedAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" });
  const icon = s.mode === "hifz" ? "school" : s.mode === "passage" ? "reader" : "mic";
  return (
    <Card onPress={() => router.push(`/session/${s.id}`)} style={{ paddingVertical: space(1.5) }}>
      <Row gap={space(1.5)}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            backgroundColor: s.mode === "hifz" ? c.goldSoft : c.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={s.mode === "hifz" ? c.gold : c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="heading" numberOfLines={1}>
            {sessionTitle(s, lang)}{" "}
            <T v="label" muted>
              {sessionRange(s, num)}
            </T>
          </T>
          <T v="caption" muted>
            {t(`history.${s.mode}`)} · {date} · {formatDuration(s.durationMs, num)}
          </T>
        </View>
        <View style={{ alignItems: "center", minWidth: 40 }}>
          <T v="heading" color={s.mistakeCount ? c.danger : c.primary}>
            {num(s.mistakeCount)}
          </T>
          <Ionicons name={s.mistakeCount ? "alert-circle" : "checkmark-circle"} size={14} color={s.mistakeCount ? c.danger : c.primary} />
        </View>
        <Ionicons name={flip("chevron-forward", "chevron-back")} size={18} color={c.textFaint} />
      </Row>
    </Card>
  );
}
