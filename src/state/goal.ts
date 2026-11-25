/**
 * Daily goal: how much you want to recite each day, measured from the saved sessions. A page counts as the share of
 * its ayahs you recited that day, so half a page is 0.5 toward a "1 page" goal.
 */
import { database } from "@/db";
import { pageAyahs, pageOf } from "@/quran";
import { amountsByDay, dayIndex, goalStreak } from "./goalMath";
import type { DayRow, GoalUnit } from "./goalMath";

export type { GoalUnit } from "./goalMath";

export interface Goal {
  unit: GoalUnit;
  amount: number;
}

/** The amounts offered for each unit. */
export const GOAL_AMOUNTS: Record<GoalUnit, number[]> = {
  pages: [1, 2, 5, 10, 20],
  ayahs: [5, 10, 20, 50],
  minutes: [5, 10, 15, 30],
};

export interface GoalProgress {
  done: number;
  amount: number;
  unit: GoalUnit;
  met: boolean;
  streak: number;
}

export function goalProgress(goal: Goal, now = Date.now()): GoalProgress {
  const rows = database().getAllSync<DayRow>("SELECT started_at, duration_ms, ayahs FROM sessions");
  const byDay = amountsByDay(rows, goal.unit, pageOf, (p) => pageAyahs(p).length);
  const today = dayIndex(now);
  const done = byDay.get(today) ?? 0;
  return { done, amount: goal.amount, unit: goal.unit, met: done >= goal.amount - 1e-6, streak: goalStreak(byDay, goal.amount, today) };
}
