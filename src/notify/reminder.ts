/**
 * The daily-goal reminder: one gentle local notification a day at the chosen time. Reminders are scheduled a week
 * ahead as one-off notifications, so today's can be dropped once the goal is met; the schedule is rebuilt whenever
 * the app opens, a session is saved, or the settings change.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { subscribeDb } from "@/db";
import { tr } from "@/i18n";
import { arabicDigits } from "@/quran";
import { goalProgress } from "@/state/goal";
import { getSettings } from "@/state/settings";

const CHANNEL = "daily-goal";
const DAYS_AHEAD = 7;

let channelReady = false;
async function ensureChannel() {
  if (channelReady || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: tr("reminder.channel"),
    // eslint-disable-next-line import/namespace -- re-exported enum the lint resolver can't see
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Asks for notification permission. Resolves true when reminders can be shown. */
export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

let syncing: Promise<void> = Promise.resolve();

/** Rebuilds the scheduled reminders from the current settings and today's progress. */
export function syncReminders(): Promise<void> {
  syncing = syncing.then(doSync, doSync).catch(() => {});
  return syncing;
}

async function doSync() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const s = getSettings();
  if (!s.reminder || !s.goal) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannel();

  const progress = goalProgress(s.goal);
  const num = (n: number) => (s.language === "ar" ? arabicDigits(n) : String(n));
  const now = Date.now();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const at = new Date();
    at.setHours(s.reminderHour, s.reminderMinute, 0, 0);
    at.setDate(at.getDate() + i);
    if (at.getTime() <= now) continue;
    if (i === 0 && progress.met) continue; // done for today: no nudge
    // Today's reminder mentions the streak that's at stake; later ones vary their wording.
    const streak = i === 0 ? progress.streak : 0;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: tr("reminder.title"),
        body: streak > 0 ? tr("reminder.bodyStreak", { n: num(streak) }) : tr(`reminder.body${i % 3}`),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

let started = false;
/** Call once at startup: syncs now, and again after every saved session. */
export function startReminders() {
  if (started) return;
  started = true;
  syncReminders();
  let timer: ReturnType<typeof setTimeout> | null = null;
  subscribeDb(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(syncReminders, 1000);
  });
}
