/** Hifz test setup: choose a surah and ayah range, and how upcoming words are hidden. */
import { useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n";
import { SURAHS } from "@/quran";
import { updateSettings, useSettings } from "@/state/settings";
import { Button, Card, Header, Row, Screen, Segmented, T, Tap } from "@/ui/kit";
import { fonts, radius, space, useTheme } from "@/ui/theme";

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const { c } = useTheme();
  const { num } = useI18n();
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <View style={{ flex: 1 }}>
      <T v="label" muted style={{ marginBottom: 6 }}>
        {label}
      </T>
      <Row style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4, justifyContent: "space-between" }}>
        <Tap
          onPress={() => step(-1)}
          onLongPress={() => step(-10)}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="remove" size={20} color={c.text} />
        </Tap>
        <T v="title" center>
          {num(value)}
        </T>
        <Tap
          onPress={() => step(1)}
          onLongPress={() => step(10)}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="add" size={20} color={c.text} />
        </Tap>
      </Row>
    </View>
  );
}

export default function HifzSetup() {
  const params = useLocalSearchParams<{ s?: string; from?: string; to?: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const { t, tc, num, lang, align } = useI18n();
  const settings = useSettings();
  const [s, setS] = useState(Number(params.s ?? 1));
  const meta = SURAHS[s - 1];
  const [from, setFrom] = useState(Number(params.from ?? 1));
  const [to, setTo] = useState(Number(params.to ?? Math.min(meta.ayahs, 7)));
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter((x) => String(x.n) === q || x.en.toLowerCase().includes(q) || x.ar.includes(q) || x.ar.replace(/[ً-ْٰٱ]/g, "").includes(q));
  }, [query]);

  const pick = (n: number) => {
    const m = SURAHS[n - 1];
    setS(n);
    setFrom(1);
    setTo(Math.min(m.ayahs, 10));
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <Header back title={t("hifz.setupTitle")} subtitle={t("hifz.setupSubtitle")} />
      <View style={{ paddingHorizontal: space(2), gap: space(1.5) }}>
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <T v="label" muted>
                {t("hifz.surah")} {num(s)}
              </T>
              <T style={{ fontFamily: fonts.quran, fontSize: 26, lineHeight: 50 }}>سُورَةُ {meta.ar}</T>
              {lang !== "ar" && (
                <T v="caption" muted>
                  {meta.en}
                </T>
              )}
            </View>
            <View style={{ backgroundColor: c.goldSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill }}>
              <T v="label" color={c.gold}>
                {tc("hifz.ayahCount", to - from + 1)}
              </T>
            </View>
          </Row>
          <Row gap={space(1.5)} style={{ marginTop: space(1.5) }}>
            <Stepper label={t("hifz.from")} value={from} min={1} max={to} onChange={setFrom} />
            <Stepper label={t("hifz.to")} value={to} min={from} max={meta.ayahs} onChange={setTo} />
          </Row>
          <T v="label" muted style={{ marginTop: space(1.5), marginBottom: 6 }}>
            {t("hifz.hideMode")}
          </T>
          <Segmented
            value={settings.hifzHide}
            onChange={(v) => updateSettings({ hifzHide: v })}
            options={[
              { value: "hidden", label: t("hifz.hidden") },
              { value: "blur", label: t("hifz.blurred") },
            ]}
          />
        </Card>

        <Row style={{ backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: space(2), borderWidth: 1, borderColor: c.border }}>
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("hifz.searchSurah")}
            placeholderTextColor={c.textFaint}
            style={{ flex: 1, height: 46, color: c.text, fontFamily: fonts.regular, fontSize: 15, textAlign: align }}
          />
        </Row>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(x) => String(x.n)}
        contentContainerStyle={{ padding: space(2), paddingBottom: 120, gap: 6 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        renderItem={({ item }) => {
          const on = item.n === s;
          return (
            <Tap
              onPress={() => pick(item.n)}
              scaleTo={0.98}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space(1.5),
                padding: space(1.25),
                borderRadius: radius.md,
                backgroundColor: on ? c.primarySoft : "transparent",
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: on ? c.primary : c.border,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: "45deg" }],
                }}
              >
                <T v="caption" center color={on ? c.primary : c.textMuted} style={{ transform: [{ rotate: "-45deg" }] }}>
                  {num(item.n)}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="heading" color={on ? c.primary : c.text}>
                  {lang === "ar" ? item.ar : item.en}
                </T>
                <T v="caption" muted>
                  {t(item.type === "meccan" ? "mushaf.meccan" : "mushaf.medinan")} · {tc("hifz.ayahCount", item.ayahs)}
                </T>
              </View>
              {lang !== "ar" && <T style={{ fontFamily: fonts.quran, fontSize: 20, lineHeight: 40, color: c.textMuted }}>{item.ar}</T>}
            </Tap>
          );
        }}
      />

      <View style={{ position: "absolute", bottom: 0, start: 0, end: 0, padding: space(2), paddingBottom: space(4), backgroundColor: c.bg }}>
        <Row gap={space(1)}>
          <Button
            title={t("hifz.learn")}
            icon="headset"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push(`/recite?mode=passage&learn=1&hide=0&s=${s}&from=${from}&to=${to}`)}
          />
          <Button
            title={t("hifz.start")}
            icon="mic"
            style={{ flex: 1 }}
            onPress={() => router.push(`/recite?mode=hifz&s=${s}&from=${from}&to=${to}`)}
          />
        </Row>
      </View>
    </Screen>
  );
}
