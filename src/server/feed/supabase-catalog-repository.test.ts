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

  it("recovers an expired running row before acquiring a new lock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T01:00:00.000Z"));
    const recoverBefore = vi.fn().mockResolvedValue({ error: null });
    const insertSingle = vi.fn().mockResolvedValue({
      data: {
        id: "run-new",
        status: "running",
        discovered_count: 0,
        analyzed_count: 0,
        kept_count: 0,
        rejected_count: 0,
        duplicate_count: 0,
        started_at: "2026-07-12T01:00:00.000Z",
        completed_at: null,
        error: null,
      },
      error: null,
    });
    const writer = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ lt: recoverBefore })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: insertSingle })),
        })),
      })),
    };
    const repository = new SupabaseCatalogRepository(
      {} as SupabaseClient,
      writer as unknown as SupabaseClient,
    );

    try {
      await repository.createRefreshRun();
      expect(recoverBefore).toHaveBeenCalledWith(
        "started_at",
        "2026-07-12T00:45:00.000Z",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not acquire a lock when stale-run recovery fails", async () => {
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }));
    const writer = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            lt: vi.fn().mockResolvedValue({
              error: { message: "recovery unavailable" },
            }),
          })),
        })),
        insert,
      })),
    };
    const repository = new SupabaseCatalogRepository(
      {} as SupabaseClient,
      writer as unknown as SupabaseClient,
    );

    await expect(repository.createRefreshRun()).rejects.toThrow(
      "Failed to recover stale refresh runs",
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("leaves a fresh active row running while recovering only expired rows", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T01:00:00.000Z"));
    const runs = [
      { id: "fresh", status: "running", started_at: "2026-07-12T00:50:00.000Z" },
      { id: "stale", status: "running", started_at: "2026-07-12T00:40:00.000Z" },
    ];
    const writer = {
      from: vi.fn(() => ({
        update: vi.fn((patch: Record<string, unknown>) => ({
          eq: vi.fn((_statusColumn: string, status: string) => ({
            lt: vi.fn((_startedColumn: string, cutoff: string) => {
              for (const run of runs) {
                if (run.status === status && run.started_at < cutoff) {
                  Object.assign(run, patch);
                }
              }
              return Promise.resolve({ error: null });
            }),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "run-new",
                status: "running",
                discovered_count: 0,
                analyzed_count: 0,
                kept_count: 0,
                rejected_count: 0,
                duplicate_count: 0,
                started_at: "2026-07-12T01:00:00.000Z",
                completed_at: null,
                error: null,
              },
              error: null,
            }),
          })),
        })),
      })),
    };
    const repository = new SupabaseCatalogRepository(
      {} as SupabaseClient,
      writer as unknown as SupabaseClient,
    );

    try {
      await repository.createRefreshRun();
      expect(runs[0]).toMatchObject({ id: "fresh", status: "running" });
      expect(runs[1]).toMatchObject({
        id: "stale",
        status: "failed",
        error: "STALE_REFRESH_RECOVERED",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
