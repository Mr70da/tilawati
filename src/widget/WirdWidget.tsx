"use no memo";
/**
 * The home-screen widget: today's wird progress and where it continues. Tapping it opens the app straight into the
 * wird. Widget components can only use the widget primitives, no hooks.
 */
import { FlexWidget, TextWidget } from "react-native-android-widget";

export interface WirdWidgetData {
  title: string;
  progress: string;
  ratio: number;
  met: boolean;
  status: string;
  continueLine: string;
  streak: string | null;
  dark: boolean;
  rtl: boolean;
  /** The widget's width in dp, from WidgetInfo: the bar is drawn in fixed widths (weighted flex doesn't render). */
  width: number;
}

const FONT = "IBMPlexSansArabic_400Regular";
const BOLD = "IBMPlexSansArabic_700Bold";

export function WirdWidget(d: WirdWidgetData) {
  const bg = d.dark ? "#10241E" : "#FBF8F1";
  const text = d.dark ? "#F2EFE6" : "#14231E";
  const muted = d.dark ? "#9DB3AA" : "#5E6E67";
  const track = d.dark ? "#22392F" : "#E8E2D4";
  const accent = d.met ? "#2FA77A" : "#C9A04A";
  const align = d.rtl ? "flex-end" : "flex-start";
  const ratio = Math.max(0, Math.min(1, d.ratio));
  const barWidth = Math.max(40, Math.round(d.width - 32)); // minus the 16dp padding on each side
  const fill = Math.round(barWidth * ratio);

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: "tilawati://wird" }}
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: bg,
        borderRadius: 24,
        padding: 16,
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: align,
      }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        {d.rtl ? <StreakText d={d} /> : <TextWidget text={d.title} style={{ fontSize: 15, fontFamily: BOLD, color: text }} />}
        {d.rtl ? <TextWidget text={d.title} style={{ fontSize: 15, fontFamily: BOLD, color: text }} /> : <StreakText d={d} />}
      </FlexWidget>

      <TextWidget text={d.progress} style={{ fontSize: 20, fontFamily: BOLD, color: text }} />

      <FlexWidget
        style={{
          width: barWidth,
          height: 8,
          borderRadius: 4,
          backgroundColor: track,
          flexDirection: "row",
          justifyContent: d.rtl ? "flex-end" : "flex-start",
        }}
      >
        {fill > 0 ? (
          <FlexWidget style={{ width: fill, height: 8, borderRadius: 4, backgroundColor: accent }} />
        ) : (
          <FlexWidget style={{ width: 1, height: 8 }} />
        )}
      </FlexWidget>

      <TextWidget text={d.status} style={{ fontSize: 12, fontFamily: FONT, color: d.met ? accent : muted }} maxLines={1} />
      <TextWidget text={d.continueLine} style={{ fontSize: 13, fontFamily: FONT, color: text }} maxLines={1} />
    </FlexWidget>
  );
}

function StreakText({ d }: { d: WirdWidgetData }) {
  return <TextWidget text={d.streak ?? " "} style={{ fontSize: 13, fontFamily: BOLD, color: "#C9A04A" }} />;
}
