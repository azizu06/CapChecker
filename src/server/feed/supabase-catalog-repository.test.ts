import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { FIXTURE_CATALOG_ITEMS } from "@/fixtures/feed";

import { SupabaseCatalogRepository } from "./supabase-catalog-repository";

describe("SupabaseCatalogRepository", () => {
  it("reports a concurrent unique insert race as duplicate without replacing its id", async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const writer = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: insertSingle })),
        })),
        update: vi.fn((row: Record<string, unknown>) => ({
          eq: (column: string, value: string) => updateEq(row, column, value),
        })),
      })),
    };
    const repository = new SupabaseCatalogRepository(
      {} as SupabaseClient,
      writer as unknown as SupabaseClient,
    );

    await expect(repository.upsertItem(FIXTURE_CATALOG_ITEMS[0])).resolves.toEqual({
      inserted: false,
    });
    const [updatedRow, column, value] = updateEq.mock.calls[0];
    expect(updatedRow).not.toHaveProperty("id");
    expect(column).toBe("youtube_video_id");
    expect(value).toBe(FIXTURE_CATALOG_ITEMS[0].youtubeVideoId);
  });
});
