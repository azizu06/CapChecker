import type {
  NewCatalogItem,
  RefreshCatalogPort,
  RefreshCounts,
  RefreshRunStatus,
} from "./ports";

export type InMemoryRun = {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: RefreshRunStatus | "running";
  counts?: RefreshCounts;
  errorCode?: string;
};

/**
 * In-memory `RefreshCatalogPort` for unit tests and fixture mode. Backs the
 * same idempotent, single-video-id contract Lane B's Supabase repository
 * implements, so a refresh behaves identically against either.
 */
export function createInMemoryCatalog(
  seed: NewCatalogItem[] = [],
): RefreshCatalogPort & {
  items: Map<string, NewCatalogItem>;
  runs: InMemoryRun[];
} {
  const items = new Map<string, NewCatalogItem>(
    seed.map((item) => [item.youtubeVideoId, item]),
  );
  const runs: InMemoryRun[] = [];
  let runCounter = 0;

  return {
    items,
    runs,
    async hasVideo(youtubeVideoId) {
      return items.has(youtubeVideoId);
    },
    async upsertItem(item) {
      const inserted = !items.has(item.youtubeVideoId);
      items.set(item.youtubeVideoId, item);
      return { inserted };
    },
    async createRun({ startedAt }) {
      runCounter += 1;
      const id = `run-${runCounter}`;
      runs.push({ id, startedAt, status: "running" });
      return id;
    },
    async completeRun({ runId, status, counts, completedAt, errorCode }) {
      const run = runs.find((entry) => entry.id === runId);
      if (run) {
        run.status = status;
        run.counts = counts;
        run.completedAt = completedAt;
        run.errorCode = errorCode;
      }
    },
    async releaseRun({ runId }) {
      const index = runs.findIndex((entry) => entry.id === runId);
      if (index >= 0) runs.splice(index, 1);
    },
  };
}
