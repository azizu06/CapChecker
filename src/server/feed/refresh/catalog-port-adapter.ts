import type { CatalogItem } from "@/domain/feed";
import {
  RefreshRunAlreadyActiveError,
  type CatalogRepository,
} from "@/server/feed/catalog-repository";

import { REFRESH_IN_PROGRESS } from "./errors";
import type { NewCatalogItem, RefreshCatalogPort } from "./ports";

const toCatalogItem = (item: NewCatalogItem, id: string): CatalogItem => ({
  id,
  ...item,
});

/** Adapt the refresh runner's narrow port to the persisted feed repository. */
export function createSupabaseRefreshCatalogPort(
  repository: CatalogRepository,
): RefreshCatalogPort {
  return {
    async hasVideo(youtubeVideoId) {
      const items = await repository.listItems();
      return items.some((item) => item.youtubeVideoId === youtubeVideoId);
    },
    async upsertItem(item) {
      const existing = (await repository.listItems()).find(
        (entry) => entry.youtubeVideoId === item.youtubeVideoId,
      );
      return repository.upsertItem(
        toCatalogItem(item, existing?.id ?? crypto.randomUUID()),
      );
    },
    async createRun({ startedAt }) {
      try {
        const run = await repository.createRefreshRun({ startedAt });
        return run.id;
      } catch (error) {
        if (error instanceof RefreshRunAlreadyActiveError) {
          throw REFRESH_IN_PROGRESS;
        }
        throw error;
      }
    },
    async completeRun({ runId, status, counts, completedAt, errorCode }) {
      await repository.updateRefreshRun(runId, {
        status,
        discoveredCount: counts.discovered,
        analyzedCount: counts.analyzed,
        keptCount: counts.kept,
        rejectedCount: counts.rejected,
        duplicateCount: counts.duplicate,
        completedAt,
        error: errorCode ?? null,
      });
    },
    async releaseRun({ runId }) {
      await repository.deleteRefreshRun(runId);
    },
  };
}
