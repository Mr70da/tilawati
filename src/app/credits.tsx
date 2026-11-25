/** Attribution required by the model (CC BY 4.0), the Quran text (Tanzil) and the fonts (OFL). */
import { Linking, ScrollView } from "react-native";
import { useI18n } from "@/i18n";
import { Card, Header, Screen, T, Tap } from "@/ui/kit";
import { space, useTheme } from "@/ui/theme";

const ITEMS: { title: string; body: string; url?: string }[] = [
  {
    title: "Tilawa recitation engine",
    body: "On-device recitation tracking and memorization checking by Tilawa (tilawa.dev). SDK code © yazinsai, MIT licence.",
    url: "https://github.com/yazinsai/tilawa",
  },
  {
    title: "Listener models: spliced-clean, spliced-clean-lite",
    body: "By Tilawa (tilawa.dev), licensed CC BY 4.0. Trained and evaluated on tlog (Tarteel, CC-BY) and Quranic Universal Ayahs / the QUD alignment benchmark (QUD Technologies, CC-BY). Distilled from obadx/muaalem-model-v3_2 (MIT), with the quran-transcript phoneme inventory (MIT). Architecture and export follow k2-fsa icefall (Apache-2.0).",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
  {
    title: "Quran text",
    body: "Uthmani text of the Holy Quran from Tanzil Project, tanzil.net. Reproduced verbatim. Madani page boundaries from Tanzil quran-data.",
    url: "https://tanzil.net",
  },
  {
    title: "Recitation audio",
    body: "Ayah-by-ayah recitations by Mahmoud Khalil Al-Husary (teaching), Mishary Rashid Alafasy and Muhammad Siddiq Al-Minshawi (teaching), from EveryAyah.com.",
    url: "https://everyayah.com",
  },
  {
    title: "Tafsir",
    body: "Tafsir al-Muyassar (King Fahd Complex), Tafsir as-Sa'di, Tafsir Ibn Kathir, Ibn Kathir (abridged, English) and Ma'arif al-Qur'an (English), served by the Quran.com API and stored on the phone after the first download.",
    url: "https://quran.com",
  },
  {
    title: "Fonts",
    body: "Amiri Quran by Khaled Hosny and IBM Plex Sans Arabic by IBM, both under the SIL Open Font License 1.1.",
    url: "https://openfontlicense.org",
  },
  {
    title: "ONNX Runtime",
    body: "Inference by Microsoft ONNX Runtime (onnxruntime-react-native), MIT licence.",
    url: "https://onnxruntime.ai",
  },
];

export default function Credits() {
  const { t } = useI18n();
  const { c } = useTheme();
  return (
    <Screen edges={["top", "bottom"]}>
      <Header back title={t("credits.title")} />
      {/* Licence texts are English: always laid out left-to-right. */}
      <ScrollView style={{ direction: "ltr" }} contentContainerStyle={{ padding: space(2), gap: space(1.5) }}>
        {ITEMS.map((i) => (
          <Card key={i.title}>
            <T v="heading" style={{ textAlign: "left" }}>
              {i.title}
            </T>
            <T muted style={{ marginTop: 4, textAlign: "left" }}>
              {i.body}
            </T>
            {i.url && (
              <Tap onPress={() => Linking.openURL(i.url!)}>
                <T v="label" color={c.primary} style={{ marginTop: 6, textAlign: "left" }}>
                  {i.url}
                </T>
              </Tap>
            )}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
