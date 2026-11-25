/** Daily-goal arithmetic (pure: no database or native imports, so it runs under the unit tests). */

export type GoalUnit = "pages" | "ayahs" | "minutes";

export const dayIndex = (ms: number) => {
  const d = new Date(ms);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
};

export interface DayRow {
  started_at: number;
  duration_ms: number;
  ayahs: string;
}

/** How much of `unit` was recited on each day, keyed by day index. Exported for tests. */
export function amountsByDay(
  rows: DayRow[],
  unit: GoalUnit,
  pageOf: (s: number, a: number) => number,
  pageSize: (page: number) => number,
): Map<number, number> {
  const ayahsByDay = new Map<number, Set<string>>();
  const out = new Map<number, number>();
  for (const r of rows) {
    const day = dayIndex(r.started_at);
    if (unit === "minutes") {
      out.set(day, (out.get(day) ?? 0) + r.duration_ms / 60_000);
      continue;
    }
    let set = ayahsByDay.get(day);
    if (!set) ayahsByDay.set(day, (set = new Set()));
    for (const a of JSON.parse(r.ayahs) as string[]) set.add(a);
  }
  for (const [day, set] of ayahsByDay) {
    if (unit === "ayahs") {
      out.set(day, set.size);
      continue;
    }
    const perPage = new Map<number, number>();
    for (const id of set) {
      const [s, a] = id.split(":").map(Number);
      const p = pageOf(s, a);
      perPage.set(p, (perPage.get(p) ?? 0) + 1);
    }
    let pages = 0;
    for (const [p, n] of perPage) pages += n / pageSize(p);
    out.set(day, pages);
  }
  return out;
}

/** Consecutive days the goal was met, ending today (or yesterday, while today is still open). */
export function goalStreak(byDay: Map<number, number>, amount: number, today: number): number {
  const met = (d: number) => (byDay.get(d) ?? 0) >= amount - 1e-6;
  let streak = 0;
  for (let d = met(today) ? today : today - 1; met(d); d--) streak++;
  return streak;
}
