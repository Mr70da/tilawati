/** Keeps the home-screen widget in step with the app: after each saved session and whenever the app goes to the background. */
import { AppState, Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { subscribeDb } from "@/db";
import { wirdWidgetData } from "./data";
import { WirdWidget } from "./WirdWidget";

export function updateWirdWidget() {
  if (Platform.OS !== "android") return;
  requestWidgetUpdate({ widgetName: "Wird", renderWidget: (info) => <WirdWidget {...wirdWidgetData(info.width)} />, widgetNotFound: () => {} }).catch(
    () => {},
  );
}

let started = false;
export function startWidgetSync() {
  if (started) return;
  started = true;
  updateWirdWidget();
  subscribeDb(() => setTimeout(updateWirdWidget, 500));
  AppState.addEventListener("change", (s) => {
    if (s === "background") updateWirdWidget();
  });
}
