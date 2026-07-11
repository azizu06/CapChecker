import type { RefreshCatalogPort } from "./ports";

/**
 * INTEGRATION SEAM (Lane A ↔ Lane B).
 *
 * Lane A defines the narrow `RefreshCatalogPort` the refresh runner needs.
 * Lane B (issue #30 / feed foundation) owns the real persistence:
 *   - `src/domain/feed.ts`            — Zod `CatalogItem` / `RefreshRun`
 *   - `src/server/feed/catalog-repository.ts` — `CatalogRepository`
 *     (`listItems` / `getItem` / `upsertItem` keyed on unique
 *     `youtube_video_id`, plus refresh-run helpers) over Supabase tables
 *     `capcheck_catalog_items` / `capcheck_refresh_runs`.
 *
 * When Lane B lands, complete `createSupabaseRefreshCatalogPort` below by
 * translating this port's camelCase `NewCatalogItem` into Lane B's repository
 * calls. Field mapping is 1:1 by name; `scorecard` is stored as JSON. Until
 * then the API route falls back to the in-memory catalog in fixture mode.
 */

// TODO(lane-b integration): import Lane B's repository type and construct it,
// e.g. `import type { CatalogRepository } from "@/server/feed/catalog-repository";`
export type LaneBCatalogRepository = {
  hasItem(youtubeVideoId: string): Promise<boolean>;
  upsertItem(item: unknown): Promise<{ inserted: boolean }>;
  startRefreshRun(input: { startedAt: string }): Promise<string>;
  finishRefreshRun(input: unknown): Promise<void>;
};

export function createSupabaseRefreshCatalogPort(
  repository: LaneBCatalogRepository,
): RefreshCatalogPort {
  // TODO(lane-b integration): delegate each method to `repository`, mapping
  // `NewCatalogItem` → Lane B's `CatalogItem` insert shape. The signatures are
  // already aligned; this is a thin pass-through the orchestrator completes.
  void repository;
  throw new Error(
    "createSupabaseRefreshCatalogPort is pending Lane B's CatalogRepository (issue #30).",
  );
}
