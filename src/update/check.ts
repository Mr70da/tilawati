/**
 * Update notice for APK installs: asks GitHub for the latest release at most twice a day and reports it when it is
 * newer than this build. Nothing is downloaded or installed automatically; the user opens the download link.
 */
import Constants from "expo-constants";
import { kvGet, kvSet } from "@/db";
import { compareVersions } from "./compare";

const REPO = "Mr70da/tilawati";
const EVERY_MS = 12 * 60 * 60 * 1000;

export const CURRENT_VERSION = Constants.expoConfig?.version ?? "0.0.0";

export interface Update {
  version: string;
  /** The APK itself when the release has one, otherwise the release page. */
  url: string;
}

interface Cache {
  at: number;
  latest: Update | null;
}

function readCache(): Cache | null {
  try {
    const raw = kvGet("update");
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

async function fetchLatest(): Promise<Update | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const r = (await res.json()) as { tag_name?: string; html_url?: string; assets?: { name: string; browser_download_url: string }[] };
  if (!r.tag_name) return null;
  const apk = r.assets?.find((a) => a.name.endsWith(".apk"));
  return { version: r.tag_name.replace(/^v/, ""), url: apk?.browser_download_url ?? r.html_url ?? `https://github.com/${REPO}/releases/latest` };
}

/**
 * The newer release, if there is one. Uses the cached answer unless it is older than 12 hours or `force` is set.
 * Offline, it falls back to the cached answer, except that a forced check rejects.
 */
export async function checkForUpdate(force = false): Promise<Update | null> {
  let cache = readCache();
  if (force || !cache || Date.now() - cache.at > EVERY_MS) {
    try {
      cache = { at: Date.now(), latest: await fetchLatest() };
      kvSet("update", JSON.stringify(cache));
    } catch (e) {
      if (force) throw e; // an explicit check reports that it couldn't reach GitHub
      // Otherwise (offline or rate-limited) keep whatever we knew.
    }
  }
  const latest = cache?.latest;
  return latest && compareVersions(latest.version, CURRENT_VERSION) > 0 ? latest : null;
}

/** "Not now" on the Home notice hides it until an even newer version comes out. */
export const isDismissed = (u: Update) => kvGet("updateDismissed") === u.version;
export const dismissUpdate = (u: Update) => kvSet("updateDismissed", u.version);
