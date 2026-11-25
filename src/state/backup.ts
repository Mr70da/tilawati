/**
 * Backup and restore: everything the app knows about you (sessions and their mistakes, bookmarks, settings, the wird
 * position) in one JSON file you can keep anywhere, such as Google Drive, and restore after reinstalling or on a new
 * phone. Downloaded audio and tafsir are not included; they download again when needed.
 */
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { exportTables, replaceTables } from "@/db";
import type { BackupTables } from "@/db";
import { setLanguage } from "@/i18n";
import { syncReminders } from "@/notify/reminder";
import { getSettings, reloadSettings } from "@/state/settings";

const APP = "tilawati";
const FORMAT = 1;

interface BackupFile {
  app: typeof APP;
  format: number;
  version: string;
  exportedAt: number;
  data: BackupTables;
}

/** Writes a backup file and opens the share sheet so it can be saved to Drive, Files, email… */
export async function shareBackup(dialogTitle: string): Promise<void> {
  const backup: BackupFile = {
    app: APP,
    format: FORMAT,
    version: Constants.expoConfig?.version ?? "",
    exportedAt: Date.now(),
    data: exportTables(),
  };
  const day = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `tilawati-backup-${day}.json`);
  if (file.exists) file.delete();
  await file.write(JSON.stringify(backup));
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle });
}

export type RestoreResult = { ok: true; sessions: number } | { ok: false; reason: "canceled" | "invalid" };

/** Lets the user pick a backup file and replaces the app's data with it. */
export async function pickAndRestore(): Promise<RestoreResult> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.[0]) return { ok: false, reason: "canceled" };
  let backup: BackupFile;
  try {
    backup = JSON.parse(await new File(picked.assets[0].uri).text()) as BackupFile;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (backup?.app !== APP || typeof backup.format !== "number" || backup.format > FORMAT || !backup.data || !Array.isArray(backup.data.sessions)) {
    return { ok: false, reason: "invalid" };
  }
  try {
    replaceTables(backup.data);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  reloadSettings();
  setLanguage(getSettings().language);
  syncReminders();
  return { ok: true, sessions: backup.data.sessions.length };
}
