/** Deep link target (tilawati://wird, used by the home-screen widget): opens today's wird passage. */
import { Redirect } from "expo-router";
import { goalProgress } from "@/state/goal";
import { getSettings } from "@/state/settings";
import { wirdPassage } from "@/state/wird";

export default function WirdLink() {
  const { goal, wird } = getSettings();
  const p = goal ? goalProgress(goal) : null;
  const w = wirdPassage(wird, goal, p ? p.amount - p.done : 0);
  return <Redirect href={`/recite?mode=passage&wird=1&s=${w.surah}&from=${w.from}&to=${w.to}&hide=0`} />;
}
