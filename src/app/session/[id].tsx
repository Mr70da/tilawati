/** Session summary: score, the passage with mistakes marked inline, and the list of mistakes. */
import { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { deleteSession, getSession, sessionMistakes } from "@/db";
import { useI18n } from "@/i18n";
import { ayahRange, ayahWords, surah, wordAt } from "@/quran";
import type { AyahId } from "@/quran";
import { scoreSession } from "@/engine/score";
import { useSettings } from "@/state/settings";
import { useDb } from "@/state/useDb";
import { Button, Card, Header, IconButton, Row, Screen, T, Tap } from "@/ui/kit";
import { AyahBlock, SurahHeader } from "@/ui/quran";
import { formatDuration, sessionTitle } from "@/ui/SessionRow";
import { fonts, radius, space, useTheme } from "@/ui/theme";

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { t, num, lang } = useI18n();
  const { fontSize } = useSettings();
  const session = useDb(() => getSession(id), [id]);
  const mistakes = useDb(() => sessionMistakes(id), [id]);
  const [showAll, setShowAll] = useState(false);

  const ayahs: AyahId[] = useMemo(() => {
    if (!session) return [];
    if (session.surah && session.fromAyah && session.toAyah)
      return ayahRange({ surah: session.surah, ayah: session.fromAyah }, { surah: session.surah, ayah: session.toAyah });
    return session.ayahs.map((k) => {
      const [s, a] = k.split(":").map(Number);
      return { surah: s, ayah: a };
    });
  }, [session]);

  if (!session) {
    return (
      <Screen>
        <Header back title={t("summary.title")} />
      </Screen>
    );
  }

  const confirmed = mistakes.filter((m) => m.state === "confirmed" || m.state === "resolved");
  // Sessions saved before v2 kept only the ayahs reached: treat their words as recited.
  const recited =
    session.recited ??
    session.ayahs.flatMap((k) => {
      const [s, a] = k.split(":").map(Number);
      return ayahWords(s, a).map((_, i) => `${s}:${a}:${i + 1}`);
    });
  const score = scoreSession({
    passage:
      session.surah && session.fromAyah && session.toAyah ? { surah: session.surah, fromAyah: session.fromAyah, toAyah: session.toAyah } : null,
    recited,
    hints: session.hints,
    mistakes: confirmed,
    wordCount: (s, a) => ayahWords(s, a).length,
  });
  const accuracy = score.accuracy;
  const verdict = accuracy >= 97 ? "excellent" : accuracy >= 85 ? "good" : "practice";
  const ringColor = verdict === "excellent" ? c.primary : verdict === "good" ? c.gold : c.danger;
  const visible = showAll ? ayahs : ayahs.slice(0, 12);

  const STATUS = { correct: "recited", mistake: "confirmed", hint: "hint", missed: "suspected", unreached: "pending" } as const;
  const statusesFor = (s: number, a: number) =>
    ayahWords(s, a)
      .map((_, i) => STATUS[score.result(s, a, i + 1)])
      .join(",");

  const remove = () =>
    Alert.alert(t("summary.delete"), t("summary.deleteConfirm"), [
      { text: t("summary.cancel"), style: "cancel" },
      {
        text: t("summary.delete"),
        style: "destructive",
        onPress: () => {
          deleteSession(id);
          router.back();
        },
      },
    ]);

  const retry = () => {
    const first = ayahs[0];
    const last = ayahs[ayahs.length - 1];
    if (!first) return;
    const to = last && last.surah === first.surah ? last.ayah : surah(first.surah).ayahs;
    router.replace(`/recite?mode=${session.mode === "free" ? "passage" : session.mode}&s=${first.surah}&from=${first.ayah}&to=${to}`);
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <Header
        back
        title={t("summary.title")}
        subtitle={`${sessionTitle(session, lang)} · ${t(`history.${session.mode}`)}`}
        trailing={<IconButton icon="trash-outline" label={t("summary.delete")} onPress={remove} tint={c.danger} />}
      />
      <ScrollView contentContainerStyle={{ padding: space(2), gap: space(2), paddingBottom: space(4) }}>
        <Animated.View entering={FadeIn.duration(320)}>
          <Card style={{ alignItems: "center", paddingVertical: space(3) }}>
            <View
              style={{
                width: 132,
                height: 132,
                borderRadius: 66,
                borderWidth: 10,
                borderColor: ringColor,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.surfaceAlt,
              }}
            >
              <T v="display" center color={ringColor}>
                {num(accuracy)}%
              </T>
              <T v="caption" muted center>
                {t("summary.accuracy")}
              </T>
            </View>
            <T v="title" center style={{ marginTop: space(1.5) }}>
              {t(`summary.${verdict}`)}
            </T>
            <Row style={{ marginTop: space(2), justifyContent: "space-around", alignSelf: "stretch" }}>
              <Mini icon="time-outline" value={formatDuration(session.durationMs, num)} label={t("summary.duration")} />
              <Mini icon="text-outline" value={`${num(score.correct)}/${num(score.total)}`} label={t("summary.words")} />
              {score.hints > 0 && <Mini icon="bulb-outline" value={num(score.hints)} label={t("summary.hints")} color={c.gold} />}
              <Mini
                icon="alert-circle-outline"
                value={num(confirmed.length)}
                label={t("summary.mistakes")}
                color={confirmed.length ? c.danger : undefined}
              />
            </Row>
          </Card>
        </Animated.View>

        {confirmed.length === 0 ? (
          <Card style={{ alignItems: "center" }}>
            <Ionicons name="checkmark-circle" size={32} color={c.primary} />
            <T center style={{ marginTop: 6 }}>
              {t("summary.noMistakes")}
            </T>
          </Card>
        ) : (
          <View style={{ gap: space(1) }}>
            <T v="heading">{t("summary.mistakes")}</T>
            {confirmed.map((m, i) => (
              <Animated.View key={m.id} entering={FadeInDown.delay(i * 40)}>
                <Card style={{ paddingVertical: space(1.25) }}>
                  <Row gap={space(1.5)}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: c.dangerSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name={
                          m.errorClass === "omitted_word"
                            ? "remove-circle-outline"
                            : m.errorClass === "added_word"
                              ? "add-circle-outline"
                              : m.errorClass === "skipped_passage"
                                ? "play-skip-forward-outline"
                                : "swap-horizontal"
                        }
                        size={18}
                        color={c.danger}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="label" color={c.danger}>
                        {t(
                          `errorClass.${["wrong_word", "omitted_word", "added_word", "skipped_passage"].includes(m.errorClass) ? m.errorClass : "other"}`,
                        )}
                      </T>
                      <T v="caption" muted>
                        {lang === "ar" ? surah(m.location.surah).ar : surah(m.location.surah).en} {num(m.location.surah)}:{num(m.location.ayah)}
                      </T>
                    </View>
                    <T style={{ fontFamily: fonts.quran, fontSize: 24, lineHeight: 46 }}>
                      {wordAt(m.location.surah, m.location.ayah, m.location.word) ?? ""}
                    </T>
                  </Row>
                </Card>
              </Animated.View>
            ))}
          </View>
        )}

        {ayahs.length > 0 && (
          <Card style={{ backgroundColor: c.paper }}>
            <T v="label" muted style={{ marginBottom: space(1) }}>
              {t("summary.passage")}
            </T>
            {visible.map((x, i) => (
              <View key={`${x.surah}:${x.ayah}`}>
                {(i === 0 || x.ayah === 1) && <SurahHeader n={x.surah} compact />}
                <AyahBlock surah={x.surah} ayah={x.ayah} fontSize={fontSize - 2} statuses={statusesFor(x.surah, x.ayah)} />
              </View>
            ))}
            {ayahs.length > visible.length && (
              <Tap onPress={() => setShowAll(true)} style={{ alignSelf: "center", padding: space(1) }}>
                <Ionicons name="chevron-down" size={22} color={c.primary} />
              </Tap>
            )}
          </Card>
        )}

        <Button title={t("summary.retryWeak")} icon="refresh" kind="secondary" onPress={retry} />
        <Button title={t("summary.done")} onPress={() => router.dismissTo("/")} />
      </ScrollView>
    </Screen>
  );
}

function Mini({
  icon,
  value,
  label,
  color,
}: {
  icon: "time-outline" | "text-outline" | "alert-circle-outline" | "bulb-outline";
  value: string;
  label: string;
  color?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.md,
          backgroundColor: c.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <Ionicons name={icon} size={18} color={color ?? c.textMuted} />
      </View>
      <T v="heading" center color={color}>
        {value}
      </T>
      <T v="caption" muted center>
        {label}
      </T>
    </View>
  );
}
