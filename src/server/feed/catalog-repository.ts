import {
  CatalogItemSchema,
  RefreshRunSchema,
  type CatalogItem,
  type RefreshRun,
  type RefreshRunStatus,
} from "@/domain/feed";
import { FIXTURE_CATALOG_ITEMS } from "@/fixtures/feed";

export type CatalogFilter = {
  category?: string;
  search?: string;
};

export type NewRefreshRun = {
  status?: RefreshRunStatus;
  discoveredCount?: number;
  analyzedCount?: number;
  keptCount?: number;
  rejectedCount?: number;
  duplicateCount?: number;
};

export type RefreshRunPatch = Partial<
  Pick<
    RefreshRun,
    | "status"
    | "discoveredCount"
    | "analyzedCount"
    | "keptCount"
    | "rejectedCount"
    | "duplicateCount"
    | "completedAt"
    | "error"
  >
>;

export interface CatalogRepository {
  listItems(filter?: CatalogFilter): Promise<CatalogItem[]>;
  getItem(id: string): Promise<CatalogItem | null>;
  upsertItem(item: CatalogItem): Promise<{ inserted: boolean }>;
  createRefreshRun(input?: NewRefreshRun): Promise<RefreshRun>;
  updateRefreshRun(id: string, patch: RefreshRunPatch): Promise<RefreshRun>;
}

/** Raw shape of a `capcheck_catalog_items` row (snake_case). */
export type CatalogItemRow = {
  id: string;
  youtube_video_id: string;
  url: string | null;
  title: string | null;
  channel_title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  category: string | null;
  tldr: string | null;
  cap_score: number | null;
  cap_label: string | null;
  scorecard: unknown;
  analyzed_at: string | null;
};

/** Raw shape of a `capcheck_refresh_runs` row (snake_case). */
export type RefreshRunRow = {
  id: string;
  status: string;
  discovered_count: number;
  analyzed_count: number;
  kept_count: number;
  rejected_count: number;
  duplicate_count: number;
  started_at: string;
  completed_at: string | null;
  error: string | null;
};

const toIso = (value: string | null): string | null =>
  value === null ? null : new Date(value).toISOString();

export function rowToCatalogItem(row: CatalogItemRow): CatalogItem {
  return CatalogItemSchema.parse({
    id: row.id,
    youtubeVideoId: row.youtube_video_id,
    url: row.url,
    title: row.title,
    channelTitle: row.channel_title,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    category: row.category,
    tldr: row.tldr,
    capScore: row.cap_score,
    capLabel: row.cap_label,
    scorecard: row.scorecard,
    analyzedAt: toIso(row.analyzed_at),
  });
}

export function catalogItemToRow(
  item: CatalogItem,
): Omit<CatalogItemRow, "id"> & { id?: string } {
  return {
    id: item.id,
    youtube_video_id: item.youtubeVideoId,
    url: item.url,
    title: item.title,
    channel_title: item.channelTitle,
    thumbnail_url: item.thumbnailUrl,
    duration_seconds: item.durationSeconds,
    category: item.category,
    tldr: item.tldr,
    cap_score: item.capScore,
    cap_label: item.capLabel,
    scorecard: item.scorecard,
    analyzed_at: item.analyzedAt,
  };
}

export function rowToRefreshRun(row: RefreshRunRow): RefreshRun {
  return RefreshRunSchema.parse({
    id: row.id,
    status: row.status,
    discoveredCount: row.discovered_count,
    analyzedCount: row.analyzed_count,
    keptCount: row.kept_count,
    rejectedCount: row.rejected_count,
    duplicateCount: row.duplicate_count,
    startedAt: toIso(row.started_at),
    completedAt: toIso(row.completed_at),
    error: row.error,
  });
}

const matchesFilter = (item: CatalogItem, filter?: CatalogFilter): boolean => {
  if (filter?.category && item.category !== filter.category) return false;
  if (filter?.search) {
    const needle = filter.search.trim().toLowerCase();
    if (needle) {
      const haystack =
        `${item.title} ${item.channelTitle} ${item.tldr}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
  }
  return true;
};

const byAnalyzedAtDesc = (a: CatalogItem, b: CatalogItem): number =>
  b.analyzedAt.localeCompare(a.analyzedAt);

/**
 * In-memory {@link CatalogRepository}. Backs the automated tests and, when
 * seeded with {@link FIXTURE_CATALOG_ITEMS}, the fixture runtime used whenever
 * Supabase env vars are absent or `CAPCHECK_FEED_MODE=fixture`.
 */
export class InMemoryCatalogRepository implements CatalogRepository {
  private readonly items: Map<string, CatalogItem>;
  private readonly runs: Map<string, RefreshRun> = new Map();
  private sequence = 0;

  constructor(seed: readonly CatalogItem[] = []) {
    this.items = new Map(seed.map((item) => [item.youtubeVideoId, item]));
  }

  async listItems(filter?: CatalogFilter): Promise<CatalogItem[]> {
    return [...this.items.values()]
      .filter((item) => matchesFilter(item, filter))
      .sort(byAnalyzedAtDesc);
  }

  async getItem(id: string): Promise<CatalogItem | null> {
    for (const item of this.items.values()) {
      if (item.id === id) return item;
    }
    return null;
  }

  async upsertItem(item: CatalogItem): Promise<{ inserted: boolean }> {
    const inserted = !this.items.has(item.youtubeVideoId);
    this.items.set(item.youtubeVideoId, item);
    return { inserted };
  }

  async createRefreshRun(input: NewRefreshRun = {}): Promise<RefreshRun> {
    this.sequence += 1;
    const run = RefreshRunSchema.parse({
      id: `refresh-run-${this.sequence}`,
      status: input.status ?? "running",
      discoveredCount: input.discoveredCount ?? 0,
      analyzedCount: input.analyzedCount ?? 0,
      keptCount: input.keptCount ?? 0,
      rejectedCount: input.rejectedCount ?? 0,
      duplicateCount: input.duplicateCount ?? 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
    });
    this.runs.set(run.id, run);
    return run;
  }

  async updateRefreshRun(
    id: string,
    patch: RefreshRunPatch,
  ): Promise<RefreshRun> {
    const existing = this.runs.get(id);
    if (!existing) throw new Error(`Unknown refresh run: ${id}`);
    const updated = RefreshRunSchema.parse({ ...existing, ...patch });
    this.runs.set(id, updated);
    return updated;
  }
}

export function createFixtureCatalogRepository(): CatalogRepository {
  return new InMemoryCatalogRepository(FIXTURE_CATALOG_ITEMS);
}

const hasSupabaseEnv = (): boolean =>
  Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

let cached: CatalogRepository | undefined;

/**
 * Resolve the active repository. Uses Supabase when its env vars are present,
 * and falls back to the fixture-backed repository when they are absent or when
 * `CAPCHECK_FEED_MODE=fixture` forces it. The Supabase implementation is loaded
 * lazily so the fixture/test path never pulls in server-only modules.
 */
export async function getCatalogRepository(): Promise<CatalogRepository> {
  if (cached) return cached;

  if (process.env.CAPCHECK_FEED_MODE === "fixture" || !hasSupabaseEnv()) {
    cached = createFixtureCatalogRepository();
    return cached;
  }

  const { createSupabaseCatalogRepository } = await import(
    "./supabase-catalog-repository"
  );
  cached = createSupabaseCatalogRepository();
  return cached;
}
