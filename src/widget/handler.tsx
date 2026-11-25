/** Renders the wird widget when Android asks (added, resized, or the 30-minute refresh that rolls it over at midnight). */
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { wirdWidgetData } from "./data";
import { WirdWidget } from "./WirdWidget";

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      props.renderWidget(<WirdWidget {...wirdWidgetData(props.widgetInfo.width)} />);
      break;
    default:
      break;
  }
}
