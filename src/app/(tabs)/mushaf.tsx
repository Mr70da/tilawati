/**
 * The Madani mushaf, 604 pages, paged right-to-left like a printed copy. Ayahs flow as continuous text per page;
 * long-press an ayah to recite from it, test yourself on the page, or bookmark it.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, Text, useWindowDimensions, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { listBookmarks, toggleBookmark } from "@/db";
import { useI18n } from "@/i18n";
import { arabicDigits, ayahWords, juzOf, PAGE_COUNT, pageAyahs, showsBasmala, surah } from "@/quran";
import type { AyahId } from "@/quran";
import { updateSettings, useSettings } from "@/state/settings";
import { useDb } from "@/state/useDb";
import { setWird } from "@/state/wird";
import { Button, IconButton, Row, Screen, T } from "@/ui/kit";
import { Basmala, SurahHeader } from "@/ui/quran";
import { Sheet } from "@/ui/Sheet";
import { fonts, radius, space, useTheme } from "@/ui/theme";

const PAGES = Array.from({ length: PAGE_COUNT }, (_, i) => i + 1);

const MushafPage = memo(function MushafPage({
  page,
  width,
  fontSize,
  bookmarks,
  onAyahLongPress,
}: {
  page: number;
  width: number;
  fontSize: number;
  bookmarks: Set<string>;
  onAyahLongPress: (a: AyahId) => void;
}) {
  const { c } = useTheme();
  const groups = useMemo(() => {
    const out: { surah: number; ayahs: AyahId[] }[] = [];
    for (const a of pageAyahs(page)) {
      const last = out[out.length - 1];
      if (last && last.surah === a.surah) last.ayahs.push(a);
      else out.push({ surah: a.surah, ayahs: [a] });
    }
    return out;
  }, [page]);

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ paddingHorizontal: space(2), paddingBottom: space(4) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ backgroundColor: c.paper, borderRadius: radius.lg, padding: space(1.5), borderWidth: 1, borderColor: c.border }}>
        {groups.map((g) => (
          <View key={g.surah}>
            {g.ayahs[0].ayah === 1 && (
              <>
                <SurahHeader n={g.surah} compact />
                {showsBasmala(g.surah) && <Basmala fontSize={fontSize} />}
              </>
            )}
            <Text
              style={{ fontFamily: fonts.quran, fontSize, lineHeight: fontSize * 2.05, color: c.text, textAlign: "justify", writingDirection: "rtl" }}
            >
              {g.ayahs.map((a) => {
                const marked = bookmarks.has(`${a.surah}:${a.ayah}`);
                return (
                  <Text
                    key={a.ayah}
                    onLongPress={() => onAyahLongPress(a)}
                    suppressHighlighting
                    style={marked ? { backgroundColor: c.goldSoft } : undefined}
                  >
                    {ayahWords(a.surah, a.ayah).join(" ")}
                    <Text style={{ color: c.gold }}>{` ﴿${arabicDigits(a.ayah)}﴾ `}</Text>
                  </Text>
                );
              })}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
});

export default function Mushaf() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t, num, lang } = useI18n();
  const { lastPage, fontSize } = useSettings();
  // settings.lastPage is the single source of truth: swiping writes it, the "Go to" sheet writes it.
  const page = lastPage;
  const shown = useRef(lastPage);
  // The ayah the action sheet is for. It stays set while the sheet animates out; navigation waits for the exit.
  const [action, setAction] = useState<AyahId | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const afterClose = useRef<(() => void) | null>(null);
  const openSheet = useCallback((a: AyahId) => {
    setAction(a);
    setSheetOpen(true);
  }, []);
  const closeThen = (fn: () => void) => {
    afterClose.current = fn;
    setSheetOpen(false);
  };
  const onSheetClosed = useCallback(() => {
    const fn = afterClose.current;
    afterClose.current = null;
    fn?.();
  }, []);
  const list = useRef<FlatList<number>>(null);
  const bookmarkRows = useDb(() => listBookmarks());
  const bookmarks = useMemo(() => new Set(bookmarkRows.map((b) => `${b.surah}:${b.ayah}`)), [bookmarkRows]);

  // Jumps from the "Go to" sheet arrive through settings.lastPage.
  useEffect(() => {
    if (lastPage !== shown.current) {
      shown.current = lastPage;
      list.current?.scrollToIndex({ index: lastPage - 1, animated: false });
    }
  }, [lastPage]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const p = Math.round(e.nativeEvent.contentOffset.x / width) + 1;
      if (p !== shown.current && p >= 1 && p <= PAGE_COUNT) {
        shown.current = p;
        updateSettings({ lastPage: p });
      }
    },
    [width],
  );

  const first = pageAyahs(page)[0];
  const meta = surah(first.surah);

  const renderItem = useCallback(
    ({ item }: { item: number }) => <MushafPage page={item} width={width} fontSize={fontSize} bookmarks={bookmarks} onAyahLongPress={openSheet} />,
    [width, fontSize, bookmarks, openSheet],
  );

  /** The last ayah of `a`'s surah on the current page. */
  const pageEnd = (a: AyahId) => {
    const onPage = pageAyahs(page).filter((x) => x.surah === a.surah);
    return onPage[onPage.length - 1]?.ayah ?? a.ayah;
  };

  return (
    <Screen>
      <Row style={{ paddingHorizontal: space(2), paddingVertical: space(1.5) }} gap={space(1.5)}>
        <View style={{ flex: 1 }}>
          <T v="title" numberOfLines={1}>
            {lang === "ar" ? `سورة ${meta.ar}` : meta.en}
          </T>
          <T v="caption" muted>
            {t("mushaf.juz", { n: num(juzOf(first.surah, first.ayah)) })} · {t("mushaf.page", { n: num(page) })}
          </T>
        </View>
        <IconButton icon="list" label={t("mushaf.jump")} onPress={() => router.push("/jump")} />
      </Row>

      {/*
        The pager is `inverted` to page right-to-left like a printed mushaf. Keep its own layout LTR: inside the
        Arabic UI's `direction: "rtl"`, Android would flip the horizontal list a second time and lose the pages.
      */}
      <View style={{ flex: 1, direction: "ltr" }}>
        <FlatList
          ref={list}
          data={PAGES}
          horizontal
          inverted
          pagingEnabled
          keyExtractor={String}
          renderItem={renderItem}
          initialScrollIndex={lastPage - 1}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={onScrollEnd}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          showsHorizontalScrollIndicator={false}
          extraData={bookmarks}
        />
      </View>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} onClosed={onSheetClosed}>
        {action && (
          <>
            <T v="heading" center>
              {lang === "ar" ? `سورة ${surah(action.surah).ar}` : surah(action.surah).en} · {num(action.ayah)}
            </T>
            <Button
              title={t("mushaf.reciteFromHere")}
              icon="mic"
              onPress={() => {
                const a = action;
                closeThen(() => router.push(`/recite?mode=passage&s=${a.surah}&from=${a.ayah}&to=${Math.max(a.ayah, pageEnd(a))}&hide=0`));
              }}
            />
            <Button
              title={t("mushaf.learnFromHere")}
              icon="headset"
              kind="secondary"
              onPress={() => {
                const a = action;
                closeThen(() => router.push(`/recite?mode=passage&learn=1&hide=0&s=${a.surah}&from=${a.ayah}&to=${Math.max(a.ayah, pageEnd(a))}`));
              }}
            />
            <Button
              title={t("mushaf.tafsir")}
              icon="library-outline"
              kind="secondary"
              onPress={() => {
                const a = action;
                closeThen(() => router.push(`/tafsir?s=${a.surah}&a=${a.ayah}`));
              }}
            />
            <Button
              title={t("mushaf.testThisPage")}
              icon="school"
              kind="secondary"
              onPress={() => {
                const a = action;
                const onPage = pageAyahs(page).filter((x) => x.surah === a.surah);
                closeThen(() => router.push(`/hifz?s=${a.surah}&from=${onPage[0].ayah}&to=${onPage[onPage.length - 1].ayah}`));
              }}
            />
            <Button
              title={t("mushaf.startWirdHere")}
              icon="flag-outline"
              kind="secondary"
              onPress={() => {
                const a = action;
                setWird({ surah: a.surah, ayah: a.ayah });
                closeThen(() => router.navigate("/"));
              }}
            />
            <Button
              title={bookmarks.has(`${action.surah}:${action.ayah}`) ? t("mushaf.removeBookmark") : t("mushaf.bookmark")}
              icon="bookmark-outline"
              kind="ghost"
              onPress={() => {
                toggleBookmark(action.surah, action.ayah);
                setSheetOpen(false);
              }}
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
