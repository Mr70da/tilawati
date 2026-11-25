import { useMemo, useSyncExternalStore } from "react";
import { dbRevision, subscribeDb } from "@/db";

/** Re-reads `read()` whenever the database changes (sessions saved or deleted, bookmarks toggled). */
export function useDb<T>(read: () => T, deps: unknown[] = []): T {
  const rev = useSyncExternalStore(subscribeDb, dbRevision, dbRevision);
  const key = JSON.stringify(deps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => read(), [rev, key]);
}
