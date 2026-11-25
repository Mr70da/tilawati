/** On-device storage: recitation sessions, their mistakes, bookmarks and settings (expo-sqlite, synchronous API). */
import { openDatabaseSync } from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import type { Mistake } from "@/engine/recitation";

let db: SQLiteDatabase | null = null;

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS sessions (
     id TEXT PRIMARY KEY NOT NULL,
     mode TEXT NOT NULL,
     surah INTEGER, from_ayah INTEGER, to_ayah INTEGER,
     started_at INTEGER NOT NULL,
     duration_ms INTEGER NOT NULL,
     tier TEXT NOT NULL,
     ayahs TEXT NOT NULL,
     words_recited INTEGER NOT NULL DEFAULT 0
   );
   CREATE INDEX IF NOT EXISTS sessions_started ON sessions(started_at DESC);
   CREATE TABLE IF NOT EXISTS mistakes (
     id TEXT NOT NULL,
     session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
     state TEXT NOT NULL,
     error_class TEXT NOT NULL,
     surah INTEGER NOT NULL, ayah INTEGER NOT NULL, word INTEGER NOT NULL,
     expected TEXT, observed TEXT,
     confidence REAL NOT NULL,
     time_ms INTEGER NOT NULL,
     PRIMARY KEY (session_id, id)
   );
   CREATE TABLE IF NOT EXISTS bookmarks (
     surah INTEGER NOT NULL, ayah INTEGER NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (surah, ayah)
   );
   CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);`,
  // v2: the exact words recited and the words revealed with hints, so the summary can score word by word.
  `ALTER TABLE sessions ADD COLUMN recited TEXT;
   ALTER TABLE sessions ADD COLUMN hints TEXT;`,
];

export function database(): SQLiteDatabase {
  if (db) return db;
  db = openDatabaseSync("tilawati.db");
  db.execSync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const row = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
  const version = row?.user_version ?? 0;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.withTransactionSync(() => db!.execSync(MIGRATIONS[i]));
    db.execSync(`PRAGMA user_version = ${i + 1}`);
  }
  return db;
}

// ---------- key/value ----------

export function kvGet(k: string): string | null {
  return database().getFirstSync<{ v: string }>("SELECT v FROM kv WHERE k = ?", k)?.v ?? null;
}

export function kvSet(k: string, v: string) {
  database().runSync("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, v);
}

// ---------- sessions ----------

export type SessionMode = "free" | "hifz" | "passage";

export interface SessionRecord {
  id: string;
  mode: SessionMode;
  surah: number | null;
  fromAyah: number | null;
  toAyah: number | null;
  startedAt: number;
  durationMs: number;
  tier: string;
  /** "s:a" keys in recitation order. */
  ayahs: string[];
  wordsRecited: number;
  /** "s:a:w" keys of the recited words; null for sessions saved before v2. */
  recited: string[] | null;
  /** "s:a:w" keys of hidden words revealed with a hint. */
  hints: string[];
  mistakeCount: number;
}

interface SessionRow {
  id: string;
  mode: SessionMode;
  surah: number | null;
  from_ayah: number | null;
  to_ayah: number | null;
  started_at: number;
  duration_ms: number;
  tier: string;
  ayahs: string;
  words_recited: number;
  recited: string | null;
  hints: string | null;
  mistake_count: number;
}

const toSession = (r: SessionRow): SessionRecord => ({
  id: r.id,
  mode: r.mode,
  surah: r.surah,
  fromAyah: r.from_ayah,
  toAyah: r.to_ayah,
  startedAt: r.started_at,
  durationMs: r.duration_ms,
  tier: r.tier,
  ayahs: JSON.parse(r.ayahs) as string[],
  wordsRecited: r.words_recited,
  recited: r.recited ? (JSON.parse(r.recited) as string[]) : null,
  hints: r.hints ? (JSON.parse(r.hints) as string[]) : [],
  mistakeCount: r.mistake_count,
});

const SESSION_SELECT = `SELECT s.*, (SELECT COUNT(*) FROM mistakes m WHERE m.session_id = s.id AND m.state IN ('confirmed', 'resolved')) AS mistake_count FROM sessions s`;

export function saveSession(s: Omit<SessionRecord, "mistakeCount">, mistakes: Mistake[]) {
  const d = database();
  d.withTransactionSync(() => {
    d.runSync(
      `INSERT OR REPLACE INTO sessions (id, mode, surah, from_ayah, to_ayah, started_at, duration_ms, tier, ayahs, words_recited, recited, hints)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id,
      s.mode,
      s.surah,
      s.fromAyah,
      s.toAyah,
      s.startedAt,
      s.durationMs,
      s.tier,
      JSON.stringify(s.ayahs),
      s.wordsRecited,
      s.recited ? JSON.stringify(s.recited) : null,
      JSON.stringify(s.hints),
    );
    for (const m of mistakes) {
      d.runSync(
        `INSERT OR REPLACE INTO mistakes (id, session_id, state, error_class, surah, ayah, word, expected, observed, confidence, time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        m.id,
        s.id,
        m.state,
        m.errorClass,
        m.location.surah,
        m.location.ayah,
        m.location.word,
        m.expected ?? null,
        m.observed ?? null,
        m.confidence,
        m.timeMs,
      );
    }
  });
  notify();
}

export function listSessions(limit = 100): SessionRecord[] {
  return database().getAllSync<SessionRow>(`${SESSION_SELECT} ORDER BY s.started_at DESC LIMIT ?`, limit).map(toSession);
}

export function getSession(id: string): SessionRecord | null {
  const r = database().getFirstSync<SessionRow>(`${SESSION_SELECT} WHERE s.id = ?`, id);
  return r ? toSession(r) : null;
}

export function sessionMistakes(id: string): Mistake[] {
  type Row = {
    id: string;
    state: Mistake["state"];
    error_class: Mistake["errorClass"];
    surah: number;
    ayah: number;
    word: number;
    expected: string | null;
    observed: string | null;
    confidence: number;
    time_ms: number;
  };
  return database()
    .getAllSync<Row>("SELECT * FROM mistakes WHERE session_id = ? ORDER BY time_ms", id)
    .map((r) => ({
      id: r.id,
      state: r.state,
      errorClass: r.error_class,
      location: { surah: r.surah, ayah: r.ayah, word: r.word },
      expected: r.expected ?? undefined,
      observed: r.observed ?? undefined,
      confidence: r.confidence,
      timeMs: r.time_ms,
    }));
}

export function deleteSession(id: string) {
  database().runSync("DELETE FROM sessions WHERE id = ?", id);
  notify();
}

// ---------- stats ----------

export interface Stats {
  sessions: number;
  totalMs: number;
  ayahs: number;
  mistakes: number;
  streakDays: number;
  /** Minutes recited on each of the last 7 days, oldest first. */
  week: number[];
  /** Surahs with the most confirmed mistakes. */
  weakSurahs: { surah: number; mistakes: number }[];
}

const dayIndex = (ms: number) => {
  const d = new Date(ms);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000);
};

export function computeStats(now = Date.now()): Stats {
  const d = database();
  const rows = d.getAllSync<{ started_at: number; duration_ms: number; ayahs: string }>(
    "SELECT started_at, duration_ms, ayahs FROM sessions ORDER BY started_at DESC",
  );
  const mistakes = d.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM mistakes WHERE state IN ('confirmed', 'resolved')")?.n ?? 0;
  const weak = d.getAllSync<{ surah: number; n: number }>(
    "SELECT surah, COUNT(*) AS n FROM mistakes WHERE state IN ('confirmed', 'resolved') GROUP BY surah ORDER BY n DESC LIMIT 5",
  );

  const days = new Set(rows.map((r) => dayIndex(r.started_at)));
  const today = dayIndex(now);
  let streak = 0;
  // A streak survives until the end of today even if today has no session yet.
  for (let day = days.has(today) ? today : today - 1; days.has(day); day--) streak++;

  const week = Array.from({ length: 7 }, () => 0);
  const distinct = new Set<string>();
  let totalMs = 0;
  for (const r of rows) {
    totalMs += r.duration_ms;
    for (const a of JSON.parse(r.ayahs) as string[]) distinct.add(a);
    const ago = today - dayIndex(r.started_at);
    if (ago >= 0 && ago < 7) week[6 - ago] += r.duration_ms / 60_000;
  }
  return {
    sessions: rows.length,
    totalMs,
    ayahs: distinct.size,
    mistakes,
    streakDays: streak,
    week,
    weakSurahs: weak.map((w) => ({ surah: w.surah, mistakes: w.n })),
  };
}

// ---------- bookmarks ----------

export function toggleBookmark(surah: number, ayah: number): boolean {
  const d = database();
  const exists = d.getFirstSync("SELECT 1 FROM bookmarks WHERE surah = ? AND ayah = ?", surah, ayah);
  if (exists) d.runSync("DELETE FROM bookmarks WHERE surah = ? AND ayah = ?", surah, ayah);
  else d.runSync("INSERT INTO bookmarks (surah, ayah, created_at) VALUES (?, ?, ?)", surah, ayah, Date.now());
  notify();
  return !exists;
}

export function listBookmarks(): { surah: number; ayah: number }[] {
  return database().getAllSync<{ surah: number; ayah: number }>("SELECT surah, ayah FROM bookmarks ORDER BY created_at DESC");
}

// ---------- change notifications (for screens that show history/stats) ----------

const subscribers = new Set<() => void>();
let revision = 0;
function notify() {
  revision++;
  for (const s of subscribers) s();
}
export function subscribeDb(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
export const dbRevision = () => revision;

// ---------- backup ----------

type Row = Record<string, string | number | null>;

/** The tables a backup carries, in an order that respects foreign keys. */
const BACKUP_TABLES = ["sessions", "mistakes", "bookmarks", "kv"] as const;
/** kv entries that describe this install rather than the user, and so are not restored. */
const LOCAL_KEYS = new Set(["update", "updateDismissed"]);

export type BackupTables = Record<(typeof BACKUP_TABLES)[number], Row[]>;

export function exportTables(): BackupTables {
  const d = database();
  const out = {} as BackupTables;
  for (const t of BACKUP_TABLES) out[t] = d.getAllSync<Row>(`SELECT * FROM ${t}`);
  out.kv = out.kv.filter((r) => !LOCAL_KEYS.has(String(r.k)));
  return out;
}

/**
 * Replaces everything with a backup, in one transaction: if any row is rejected, nothing changes. Only columns this
 * version knows are written, so a backup from an older or newer version still restores what both have.
 */
export function replaceTables(data: Partial<BackupTables>) {
  const d = database();
  d.withTransactionSync(() => {
    for (const t of [...BACKUP_TABLES].reverse()) {
      if (t === "kv") d.runSync(`DELETE FROM kv WHERE k NOT IN (${[...LOCAL_KEYS].map(() => "?").join(",")})`, ...LOCAL_KEYS);
      else d.runSync(`DELETE FROM ${t}`);
    }
    for (const t of BACKUP_TABLES) {
      const known = new Set(d.getAllSync<{ name: string }>(`PRAGMA table_info(${t})`).map((c) => c.name));
      for (const row of data[t] ?? []) {
        if (t === "kv" && LOCAL_KEYS.has(String(row.k))) continue;
        const cols = Object.keys(row).filter((c) => known.has(c));
        if (cols.length === 0) continue;
        d.runSync(`INSERT OR REPLACE INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, ...cols.map((c) => row[c] ?? null));
      }
    }
  });
  notify();
}
