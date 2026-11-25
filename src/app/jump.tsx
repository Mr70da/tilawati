/** "Go to" sheet for the mushaf: by surah or by juz. */
import { useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { useI18n } from "@/i18n";
import { JUZ, SURAHS, surah } from "@/quran";
import { updateSettings } from "@/state/settings";
import { Header, IconButton, Screen, Segmented, T, Tap } from "@/ui/kit";
import { fonts, radius, space, useTheme } from "@/ui/theme";

export default function Jump() {
  const router = useRouter();
  const { c } = useTheme();
  const { t, num, lang } = useI18n();
  const [tab, setTab] = useState<"surah" | "juz">("surah");
  const go = (page: number) => {
    updateSettings({ lastPage: page });
    router.back();
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <Header title={t("mushaf.jump")} trailing={<IconButton icon="close" label={t("common.close")} onPress={() => router.back()} />} />
      <View style={{ paddingHorizontal: space(2), marginBottom: space(1) }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "surah", label: t("mushaf.surahs") },
            { value: "juz", label: t("mushaf.juzTab") },
          ]}
        />
      </View>
      {tab === "surah" ? (
        <FlatList
          data={SURAHS}
          keyExtractor={(x) => String(x.n)}
          contentContainerStyle={{ padding: space(2), gap: 4 }}
          initialNumToRender={20}
          renderItem={({ item }) => (
            <Tap
              onPress={() => go(item.page)}
              scaleTo={0.98}
              style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), padding: space(1.25), borderRadius: radius.md }}
            >
              <T v="label" muted style={{ width: 28 }} center>
                {num(item.n)}
              </T>
              <View style={{ flex: 1 }}>
                <T v="heading">{lang === "ar" ? item.ar : item.en}</T>
                <T v="caption" muted>
                  {t(item.type === "meccan" ? "mushaf.meccan" : "mushaf.medinan")} · {t("mushaf.page", { n: num(item.page) })}
                </T>
              </View>
              {lang !== "ar" && <T style={{ fontFamily: fonts.quran, fontSize: 20, lineHeight: 40, color: c.textMuted }}>{item.ar}</T>}
            </Tap>
          )}
        />
      ) : (
        <FlatList
          data={JUZ}
          numColumns={3}
          keyExtractor={(x) => String(x.n)}
          contentContainerStyle={{ padding: space(2), gap: space(1) }}
          columnWrapperStyle={{ gap: space(1) }}
          renderItem={({ item }) => (
            <Tap
              onPress={() => go(item.page)}
              style={{
                flex: 1,
                backgroundColor: c.surface,
                borderRadius: radius.md,
                padding: space(1.5),
                alignItems: "center",
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <T v="title" color={c.primary} center>
                {num(item.n)}
              </T>
              <T v="caption" muted center numberOfLines={1}>
                {lang === "ar" ? surah(item.s).ar : surah(item.s).en} {num(item.a)}
              </T>
            </Tap>
          )}
        />
      )}
    </Screen>
  );
}
