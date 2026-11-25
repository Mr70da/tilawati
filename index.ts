/** App entry: Expo Router, plus the task handler Android calls to draw the home-screen widget. */
import "expo-router/entry";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./src/widget/handler";

registerWidgetTaskHandler(widgetTaskHandler);
