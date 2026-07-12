import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CatalogItem, RefreshRun } from "@/domain/feed";

import {
  catalogItemToRow,
  rowToCatalogItem,
  rowToRefreshRun,
  RefreshRunAlreadyActiveError,
  type CatalogFilter,
  type CatalogItemRow,
  type CatalogRepository,
  type NewRefreshRun,
  type RefreshRunPatch,
  type RefreshRunRow,
} from "./catalog-repository";

const CATALOG_TABLE = "capcheck_catalog_items";
const REFRESH_TABLE = "capcheck_refresh_runs";
const STALE_REFRESH_MS = 15 * 60 * 1000;

const CATALOG_COLUMNS =
  "id, youtube_video_id, url, title, channel_title, thumbnail_url, duration_seconds, category, tldr, cap_score, cap_label, scorecard, analyzed_at";

/**
 * Guard against ever bundling this module — and the service-role key it reads —
 * into client output. The repository is only ever constructed from server
 * components, route handlers, or the seed script, none of which have `window`.
 */
function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "SupabaseCatalogRepository must never run in the browser; it reads the service-role key.",
    );
  }
}

export class SupabaseCatalogRepository implements CatalogRepository {
  private readonly reader: SupabaseClient;
  private readonly writer: SupabaseClient | null;

  constructor(reader: SupabaseClient, writer: SupabaseClient | null) {
    this.reader = reader;
    this.writer = writer;
  }

  private requireWriter(): SupabaseClient {
    if (!this.writer) {
      throw new Error(
        "Catalog writes require SUPABASE_SERVICE_ROLE_KEY in the environment.",
      );
    }
    return this.writer;
  }

  async listItems(filter?: CatalogFilter): Promise<CatalogItem[]> {
    let query = this.reader
      .from(CATALOG_TABLE)
      .select(CATALOG_COLUMNS)
      .order("analyzed_at", { ascending: false });

    if (filter?.category) query = query.eq("category", filter.category);
    if (filter?.search) {
      const term = filter.search.trim();
      if (term) {
        const pattern = `%${term}%`;
        query = query.or(
          `title.ilike.${pattern},channel_title.ilike.${pattern},tldr.ilike.${pattern}`,
        );
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list catalog items: ${error.message}`);
    return (data as CatalogItemRow[]).map(rowToCatalogItem);
  }

  async getItem(id: string): Promise<CatalogItem | null> {
    const { data, error } = await this.reader
      .from(CATALOG_TABLE)
      .select(CATALOG_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load catalog item: ${error.message}`);
    if (!data) return null;
    return rowToCatalogItem(data as CatalogItemRow);
  }

  async upsertItem(item: CatalogItem): Promise<{ inserted: boolean }> {
    const writer = this.requireWriter();
    const row = catalogItemToRow(item);
    const { error: insertError } = await writer
      .from(CATALOG_TABLE)
      .insert(row)
      .select("id")
      .single();
    if (!insertError) return { inserted: true };
    if (insertError.code !== "23505") {
      throw new Error(`Failed to insert catalog item: ${insertError.message}`);
    }

    const updateRow = { ...row };
    delete updateRow.id;
    const { error: updateError } = await writer
      .from(CATALOG_TABLE)
      .update(updateRow)
      .eq("youtube_video_id", item.youtubeVideoId);
    if (updateError) {
      throw new Error(`Failed to update catalog item: ${updateError.message}`);
    }
    return { inserted: false };
  }

  async createRefreshRun(input: NewRefreshRun = {}): Promise<RefreshRun> {
    const writer = this.requireWriter();
    const recoveredAt = new Date().toISOString();
    const staleBefore = new Date(Date.now() - STALE_REFRESH_MS).toISOString();
    const { error: recoveryError } = await writer
      .from(REFRESH_TABLE)
      .update({
        status: "failed",
        completed_at: recoveredAt,
        error: "STALE_REFRESH_RECOVERED",
      })
      .eq("status", "running")
      .lt("started_at", staleBefore);
    if (recoveryError) {
      throw new Error(
        `Failed to recover stale refresh runs: ${recoveryError.message}`,
      );
    }
    const { data, error } = await writer
      .from(REFRESH_TABLE)
      .insert({
        status: input.status ?? "running",
        started_at: input.startedAt,
        discovered_count: input.discoveredCount ?? 0,
        analyzed_count: input.analyzedCount ?? 0,
        kept_count: input.keptCount ?? 0,
        rejected_count: input.rejectedCount ?? 0,
        duplicate_count: input.duplicateCount ?? 0,
      })
      .select()
      .single();

    if (error?.code === "23505") throw new RefreshRunAlreadyActiveError();
    if (error) throw new Error(`Failed to create refresh run: ${error.message}`);
    return rowToRefreshRun(data as RefreshRunRow);
  }

  async updateRefreshRun(
    id: string,
    patch: RefreshRunPatch,
  ): Promise<RefreshRun> {
    const writer = this.requireWriter();
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.discoveredCount !== undefined)
      row.discovered_count = patch.discoveredCount;
    if (patch.analyzedCount !== undefined)
      row.analyzed_count = patch.analyzedCount;
    if (patch.keptCount !== undefined) row.kept_count = patch.keptCount;
    if (patch.rejectedCount !== undefined)
      row.rejected_count = patch.rejectedCount;
    if (patch.duplicateCount !== undefined)
      row.duplicate_count = patch.duplicateCount;
    if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
    if (patch.error !== undefined) row.error = patch.error;

    const { data, error } = await writer
      .from(REFRESH_TABLE)
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update refresh run: ${error.message}`);
    return rowToRefreshRun(data as RefreshRunRow);
  }

  async deleteRefreshRun(id: string): Promise<void> {
    const writer = this.requireWriter();
    const { error } = await writer.from(REFRESH_TABLE).delete().eq("id", id);
    if (error) throw new Error(`Failed to release refresh run: ${error.message}`);
  }
}

const noPersistOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

export function createSupabaseCatalogRepository(): SupabaseCatalogRepository {
  assertServerOnly();

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase catalog repository requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const reader = createClient(url, anonKey, noPersistOptions);
  const writer = serviceRoleKey
    ? createClient(url, serviceRoleKey, noPersistOptions)
    : null;

  return new SupabaseCatalogRepository(reader, writer);
}
