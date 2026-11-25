import { useEffect, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { computeStats, listSessions } from "@/db";
import { useI18n } from "@/i18n";
import { pageAyahs, pageOf, surah } from "@/quran";
import { goalProgress } from "@/state/goal";
import type { GoalProgress } from "@/state/goal";
import { useSettings } from "@/state/settings";
import { khatmaProgress, wirdPassage } from "@/state/wird";
import { checkForUpdate, dismissUpdate, isDismissed } from "@/update/check";
import type { Update } from "@/update/check";
import { useDb } from "@/state/useDb";
import { Button, Card, Row, Screen, T, Tap } from "@/ui/kit";
import { SessionRow } from "@/ui/SessionRow";
import { fonts, radius, space, useTheme } from "@/ui/theme";

export default function Home() {
  const router = useRouter();
  const { c, dark } = useTheme();
  const { t, num, lang, flip } = useI18n();
  const { lastPage, goal, wird } = useSettings();
  const progress = useDb(() => (goal ? goalProgress(goal) : null), [goal]);
  const stats = useDb(() => computeStats());
  const recent = useDb(() => listSessions(3));
  const firstOnPage = pageAyahs(lastPage)[0];
  const maxWeek = Math.max(10, ...stats.week);
  const dayLetters = lang === "ar" ? ["ح", "ن", "ث", "ر", "خ", "ج", "س"] : ["S", "M", "T", "W", "T", "F", "S"];
  const today = new Date().getDay();
  const [update, setUpdate] = useState<Update | null>(null);
  useEffect(() => {
    let live = true;
    checkForUpdate().then((u) => live && setUpdate(u && !isDismissed(u) ? u : null));
    return () => {
      live = false;
    };
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: space(2), paddingBottom: space(4), gap: space(2) }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: space(1) }}>
          <T v="label" color={c.gold}>
            {t("home.greeting")}
          </T>
          <T v="display">{t("appName")}</T>
          <T muted>{t("home.subtitle")}</T>
        </View>

        {update && (
          <Card style={{ borderWidth: 1, borderColor: c.primary }}>
            <Row gap={space(1.5)}>
              <Ionicons name="arrow-down-circle" size={26} color={c.primary} />
              <View style={{ flex: 1 }}>
                <T v="heading">{t("update.available", { v: num(update.version) })}</T>
                <T v="caption" muted>
                  {t("update.hint")}
                </T>
              </View>
            </Row>
            <Row gap={space(1)} style={{ marginTop: space(1.5) }}>
              <Button
                title={t("update.download")}
                icon="download-outline"
                style={{ flex: 1, height: 44 }}
                onPress={() => Linking.openURL(update.url).catch(() => {})}
              />
              <Button
                title={t("update.later")}
                kind="ghost"
                style={{ height: 44 }}
                onPress={() => {
                  dismissUpdate(update);
                  setUpdate(null);
                }}
              />
            </Row>
          </Card>
        )}

        {/* Primary action */}
        <Tap onPress={() => router.push("/recite?mode=free")} scaleTo={0.98}>
          <LinearGradient
            colors={dark ? ["#16503F", "#0D3529"] : ["#13704F", "#0B4A38"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.xl, padding: space(2.5), overflow: "hidden" }}
          >
            <T
              style={{
                position: "absolute",
                top: -18,
                end: 8,
                fontFamily: fonts.quran,
                fontSize: 120,
                lineHeight: 200,
                color: "rgba(255,255,255,0.07)",
              }}
            >
              ﴿ ﴾
            </T>
            <Row gap={space(2)}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "rgba(255,255,255,0.16)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="mic" size={30} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="title" color="#fff">
                  {t("home.startReciting")}
                </T>
                <T color="rgba(255,255,255,0.8)">{t("home.startHint")}</T>
              </View>
              <Ionicons name={flip("arrow-forward", "arrow-back")} size={22} color="#fff" />
            </Row>
          </LinearGradient>
        </Tap>

        {progress ? (
          <GoalCard
            p={progress}
            onPress={() => {
              const w = wirdPassage(wird, goal, progress.amount - progress.done);
              router.push(`/recite?mode=passage&wird=1&s=${w.surah}&from=${w.from}&to=${w.to}&hide=0`);
            }}
          />
        ) : (
          <Card onPress={() => router.push("/settings")}>
            <Row gap={space(1.5)}>
              <Ionicons name="flag-outline" size={22} color={c.gold} />
              <View style={{ flex: 1 }}>
                <T v="heading">{t("home.setGoal")}</T>
                <T v="caption" muted>
                  {t("home.setGoalHint")}
                </T>
              </View>
              <Ionicons name={flip("chevron-forward", "chevron-back")} size={18} color={c.textFaint} />
            </Row>
          </Card>
        )}

        <Row gap={space(1.5)} center={false}>
          <Card style={{ flex: 1 }} onPress={() => router.push("/hifz")}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: c.goldSoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: space(1),
              }}
            >
              <Ionicons name="school" size={20} color={c.gold} />
            </View>
            <T v="heading">{t("home.hifzTitle")}</T>
            <T v="caption" muted>
              {t("home.hifzHint")}
            </T>
          </Card>
          <Card style={{ flex: 1 }} onPress={() => router.push("/mushaf")}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: c.primarySoft,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: space(1),
              }}
            >
              <Ionicons name="book" size={20} color={c.primary} />
            </View>
            <T v="heading">{t("home.continueReading")}</T>
            <T v="caption" muted numberOfLines={1}>
              {lang === "ar" ? surah(firstOnPage.surah).ar : surah(firstOnPage.surah).en} · {t("home.page", { n: num(lastPage) })}
            </T>
          </Card>
        </Row>

        {/* Progress */}
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <Stat value={num(stats.streakDays)} label={t("home.streak")} icon="flame" color={c.gold} />
            <Stat value={num(Math.round(stats.totalMs / 60000))} label={t("home.minutes")} icon="time" color={c.primary} />
            <Stat value={num(stats.ayahs)} label={t("home.ayahs")} icon="sparkles" color={c.primary} />
          </Row>
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: space(2) }} />
          <T v="label" muted style={{ marginBottom: space(1) }}>
            {t("home.thisWeek")}
          </T>
          <Row style={{ justifyContent: "space-between", alignItems: "flex-end", height: 72 }} center={false}>
            {stats.week.map((m, i) => {
              const day = (today - 6 + i + 7) % 7;
              return (
                <View key={i} style={{ alignItems: "center", flex: 1, justifyContent: "flex-end", height: "100%" }}>
                  <View
                    style={{
                      width: 14,
                      height: Math.max(6, (m / maxWeek) * 52),
                      borderRadius: 7,
                      backgroundColor: m > 0 ? (i === 6 ? c.gold : c.primary) : c.surfaceAlt,
                    }}
                  />
                  <T v="caption" muted center style={{ marginTop: 4 }}>
                    {dayLetters[day]}
                  </T>
                </View>
              );
            })}
          </Row>
        </Card>

        <Row style={{ justifyContent: "space-between", marginTop: space(1) }}>
          <T v="heading" style={{ flex: 1 }}>
            {t("home.recent")}
          </T>
          {recent.length > 0 && (
            <Tap onPress={() => router.push("/history")}>
              <T v="label" color={c.primary}>
                {t("home.seeAll")}
              </T>
            </Tap>
          )}
        </Row>
        {recent.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: space(3) }}>
            <Ionicons name="leaf-outline" size={28} color={c.textFaint} />
            <T muted center style={{ marginTop: space(1) }}>
              {t("home.empty")}
            </T>
          </Card>
        ) : (
          recent.map((s) => <SessionRow key={s.id} s={s} />)
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label, icon, color }: { value: string; label: string; icon: "flame" | "time" | "sparkles"; color: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Row gap={4}>
        <Ionicons name={icon} size={18} color={color} />
        <T v="title">{value}</T>
      </Row>
      <T v="caption" muted center>
        {label}
      </T>
    </View>
  );
}

/** Today's goal: how far along you are, and the streak of days you met it. Tapping it continues from your page. */
function GoalCard({ p, onPress }: { p: GoalProgress; onPress: () => void }) {
  const { c } = useTheme();
  const { t, tc, num, lang } = useI18n();
  const { wird, khatmas } = useSettings();
  const khatma = khatmaProgress(wird);
  const sr = surah(wird.surah);
  const round = (n: number) => (p.unit === "pages" ? Math.floor(n * 10) / 10 : Math.floor(n));
  const done = round(p.done);
  const left = Math.max(0, p.unit === "pages" ? Math.ceil((p.amount - p.done) * 10) / 10 : Math.ceil(p.amount - p.done));
  const ratio = Math.min(1, p.done / p.amount);
  return (
    <Card onPress={onPress} style={{ gap: space(1.25) }}>
      <Row gap={space(1)}>
        <Ionicons name={p.met ? "checkmark-circle" : "flag"} size={20} color={p.met ? c.primary : c.gold} />
        <T v="heading" style={{ flex: 1 }}>
          {t("home.goalTitle")}
        </T>
        {p.streak > 0 && (
          <Row gap={4} style={{ backgroundColor: c.goldSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Ionicons name="flame" size={14} color={c.gold} />
            <T v="label" color={c.gold}>
              {num(p.streak)}
            </T>
          </Row>
        )}
      </Row>
      <Row gap={space(1)} style={{ alignItems: "baseline" }}>
        <T v="title">{num(done)}</T>
        <T muted>/ {tc(`goal.${p.unit}`, p.amount)}</T>
      </Row>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${ratio * 100}%`, height: "100%", borderRadius: 4, backgroundColor: p.met ? c.primary : c.gold }} />
      </View>
      <T v="caption" color={p.met ? c.primary : c.textMuted}>
        {p.met ? t("home.goalDone") : t("home.goalLeft", { left: tc(`goal.${p.unit}`, left) })}
      </T>

      <View style={{ height: 1, backgroundColor: c.border, marginVertical: space(0.5) }} />
      <Row gap={space(1)}>
        <Ionicons name="book-outline" size={18} color={c.primary} />
        <View style={{ flex: 1 }}>
          <T v="heading" numberOfLines={1}>
            {t("home.wirdFrom", { surah: lang === "ar" ? sr.ar : sr.en, ayah: num(wird.ayah) })}
          </T>
          <T v="caption" muted>
            {t("home.page", { n: num(pageOf(wird.surah, wird.ayah)) })} · {t("home.khatma", { pct: num(Math.floor(khatma * 100)) })}
            {khatmas > 0 ? ` · ${t("home.khatmas", { n: num(khatmas) })}` : ""}
          </T>
        </View>
        <View style={{ backgroundColor: c.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
          <T v="label" color={c.onPrimary}>
            {t("home.continueWird")}
          </T>
        </View>
      </Row>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surfaceAlt, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(1, khatma * 100)}%`, height: "100%", backgroundColor: c.primary }} />
      </View>
    </Card>
  );
}
