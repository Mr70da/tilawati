/** Tafsir of one ayah, with the ayah on top, a choice of tafsir, and previous/next ayah. */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import type { ScrollViewInstance } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useI18n } from "@/i18n";
import { arabicDigits, ayahWords, surah } from "@/quran";
import { explanationFor, surahTafsir, TAFSIRS, tafsirInfo } from "@/quran/tafsir";
import type { SurahTafsir } from "@/quran/tafsir";
import { updateSettings, useSettings } from "@/state/settings";
import { Button, Card, Chip, Header, IconButton, Row, Screen, T } from "@/ui/kit";
import { fonts, space, useTheme } from "@/ui/theme";

export default function TafsirScreen() {
  const params = useLocalSearchParams<{ s: string; a: string }>();
  const { c } = useTheme();
  const { t, num, lang, flip } = useI18n();
  const settings = useSettings();
  const [cur, setCur] = useState(() => ({ s: Number(params.s) || 1, a: Number(params.a) || 1 }));
  const info = tafsirInfo(settings.tafsir);
  const key = `${info.id}/${cur.s}`;

  const [loaded, setLoaded] = useState<{ key: string; data: SurahTafsir } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    surahTafsir(info.id, cur.s)
      .then((data) => live && setLoaded({ key, data }))
      .catch(() => live && setFailed(key));
    return () => {
      live = false;
    };
  }, [info.id, cur.s, key, attempt]);

  const data = loaded?.key === key ? loaded.data : null;
  const error = !data && failed === key;
  const ex = data ? explanationFor(data, cur.a) : null;

  const scroll = useRef<ScrollViewInstance>(null);
  /** Moves one ayah from `from`, across surah boundaries. A grouped explanation is stepped over as a whole. */
  const move = (from: number, delta: 1 | -1) => {
    let s = cur.s;
    let a = from + delta;
    if (a < 1) {
      if (s === 1) return;
      s -= 1;
      a = surah(s).ayahs;
    } else if (a > surah(s).ayahs) {
      if (s === 114) return;
      s += 1;
      a = 1;
    }
    setCur({ s, a });
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  const sr = surah(cur.s);
  const range = ex && ex.to > ex.from ? Array.from({ length: ex.to - ex.from + 1 }, (_, i) => ex.from + i) : [cur.a];
  const english = info.lang === "en";

  return (
    <Screen edges={["top", "bottom"]}>
      <Header back title={t("tafsir.title")} subtitle={`${lang === "ar" ? sr.ar : sr.en} · ${num(cur.s)}:${num(cur.a)}`} />

      {/* A wrapping row: a horizontal ScrollView stretches its chips to full height and clips Arabic labels in RTL. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1), paddingHorizontal: space(2), paddingBottom: space(1) }}>
        {TAFSIRS.map((x) => {
          const on = x.id === info.id;
          return (
            <Chip
              key={x.id}
              label={lang === "ar" ? x.arShort : x.enShort}
              color={on ? c.onPrimary : c.textMuted}
              bg={on ? c.primary : c.surfaceAlt}
              onPress={() => updateSettings({ tafsir: x.id })}
            />
          );
        })}
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: space(4) }}>
        <Card style={{ direction: "rtl" }}>
          <Text
            style={{ fontFamily: fonts.quran, fontSize: settings.fontSize, lineHeight: settings.fontSize * 2, color: c.text, textAlign: "center" }}
          >
            {range.map((a) => (
              <Text key={a}>
                {ayahWords(cur.s, a).join(" ")}
                <Text style={{ color: c.gold, fontSize: settings.fontSize * 0.9 }}>{` ﴿${arabicDigits(a)}﴾ `}</Text>
              </Text>
            ))}
          </Text>
        </Card>

        {!data && !error && (
          <Row gap={space(1)} style={{ justifyContent: "center", paddingVertical: space(4) }}>
            <ActivityIndicator color={c.primary} />
            <T muted>{t("tafsir.loading")}</T>
          </Row>
        )}

        {error && (
          <Card style={{ alignItems: "center", gap: space(1.5) }}>
            <T muted center>
              {t("tafsir.error")}
            </T>
            <Button title={t("tafsir.retry")} icon="refresh" kind="secondary" onPress={() => setAttempt((n) => n + 1)} />
          </Card>
        )}

        {data && (
          <Animated.View key={`${key}/${cur.a}`} entering={FadeIn.duration(220)} style={{ gap: space(1.5) }}>
            {ex && ex.to > ex.from && (
              <T v="label" color={c.gold}>
                {t("tafsir.covers", { from: num(ex.from), to: num(ex.to) })}
              </T>
            )}
            <View style={{ direction: english ? "ltr" : "rtl" }}>
              <Text
                selectable
                style={{
                  fontFamily: english ? undefined : fonts.regular,
                  fontSize: english ? 16 : 17,
                  lineHeight: english ? 26 : 32,
                  color: c.text,
                  textAlign: "left",
                }}
              >
                {ex?.text ?? "—"}
              </Text>
            </View>
            <T v="caption" muted>
              {t("tafsir.source")}
            </T>
          </Animated.View>
        )}
      </ScrollView>

      <Row
        style={{
          justifyContent: "space-between",
          paddingHorizontal: space(2),
          paddingVertical: space(1),
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}
      >
        <IconButton icon={flip("chevron-back", "chevron-forward")} label={t("tafsir.prev")} onPress={() => move(ex ? ex.from : cur.a, -1)} />
        <T v="label" muted>
          {num(cur.a)} / {num(sr.ayahs)}
        </T>
        <IconButton icon={flip("chevron-forward", "chevron-back")} label={t("tafsir.next")} onPress={() => move(ex ? ex.to : cur.a, 1)} />
      </Row>
    </Screen>
  );
}
