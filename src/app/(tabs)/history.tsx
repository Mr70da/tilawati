import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { computeStats, listSessions } from "@/db";
import { useI18n } from "@/i18n";
import { surah } from "@/quran";
import { useDb } from "@/state/useDb";
import { Button, Card, Row, Screen, T, Tap } from "@/ui/kit";
import { SessionRow } from "@/ui/SessionRow";
import { radius, space, useTheme } from "@/ui/theme";

export default function History() {
  const router = useRouter();
  const { c } = useTheme();
  const { t, num, lang } = useI18n();
  const sessions = useDb(() => listSessions(200));
  const stats = useDb(() => computeStats());

  if (sessions.length === 0) {
    return (
      <Screen>
        <View style={{ padding: space(2) }}>
          <T v="display">{t("history.title")}</T>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space(4), gap: space(1.5) }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="stats-chart" size={36} color={c.primary} />
          </View>
          <T v="title" center>
            {t("history.empty")}
          </T>
          <T muted center>
            {t("history.emptyHint")}
          </T>
          <Button
            title={t("home.startReciting")}
            icon="mic"
            onPress={() => router.push("/recite?mode=free")}
            style={{ marginTop: space(1), alignSelf: "stretch" }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: space(2), gap: space(1), paddingBottom: space(4) }}
        ListHeaderComponent={
          <View style={{ gap: space(2), marginBottom: space(1) }}>
            <T v="display">{t("history.title")}</T>
            <Card>
              <T v="label" muted style={{ marginBottom: space(1) }}>
                {t("history.totals")}
              </T>
              <Row style={{ justifyContent: "space-between" }}>
                <Total value={num(stats.sessions)} label={t("history.sessions")} />
                <Total value={num(Math.round(stats.totalMs / 60000))} label={t("home.minutes")} />
                <Total value={num(stats.ayahs)} label={t("home.ayahs")} />
                <Total value={num(stats.mistakes)} label={t("summary.mistakes")} color={c.danger} />
              </Row>
            </Card>
            {stats.weakSurahs.length > 0 && (
              <Card>
                <Row style={{ marginBottom: space(1) }}>
                  <Ionicons name="flag" size={16} color={c.gold} />
                  <T v="label" color={c.gold}>
                    {t("history.weakSpots")}
                  </T>
                </Row>
                <Row gap={8} style={{ flexWrap: "wrap" }}>
                  {stats.weakSurahs.map((w) => (
                    <Tap
                      key={w.surah}
                      onPress={() => router.push(`/hifz?s=${w.surah}&from=1&to=${Math.min(surah(w.surah).ayahs, 10)}`)}
                      style={{ backgroundColor: c.goldSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}
                    >
                      <T v="label" color={c.text}>
                        {lang === "ar" ? surah(w.surah).ar : surah(w.surah).en} · {num(w.mistakes)}
                      </T>
                    </Tap>
                  ))}
                </Row>
              </Card>
            )}
          </View>
        }
        renderItem={({ item }) => <SessionRow s={item} />}
      />
    </Screen>
  );
}

function Total({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <T v="title" center color={color}>
        {value}
      </T>
      <T v="caption" muted center>
        {label}
      </T>
    </View>
  );
}
