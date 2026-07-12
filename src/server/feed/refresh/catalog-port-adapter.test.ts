import { describe, expect, it } from "vitest";

import { DEMO_SCORECARDS } from "@/fixtures/scorecards";
import { InMemoryCatalogRepository } from "@/server/feed/catalog-repository";

import { createSupabaseRefreshCatalogPort } from "./catalog-port-adapter";
import type { NewCatalogItem } from "./ports";

const vettedItem = (): NewCatalogItem => ({
  youtubeVideoId: "vid-index",
  url: "https://www.youtube.com/watch?v=vid-index",
  title: "Index funds explained for beginners",
  channelTitle: "Plain Finance",
  thumbnailUrl: "https://i.ytimg.com/vi/vid-index/hq.jpg",
  durationSeconds: 200,
  category: "investing",
  tldr: "A plain-language introduction to diversified index investing.",
  capScore: DEMO_SCORECARDS.legitimate.capScore,
  capLabel: DEMO_SCORECARDS.legitimate.capLabel,
  scorecard: DEMO_SCORECARDS.legitimate,
  analyzedAt: "2026-07-11T15:30:00.000Z",
});

describe("Supabase refresh catalog adapter", () => {
  it("persists every vetted catalog field through CatalogRepository", async () => {
    const repository = new InMemoryCatalogRepository();
    const catalog = createSupabaseRefreshCatalogPort(repository);
    const item = vettedItem();

    await expect(catalog.upsertItem(item)).resolves.toEqual({ inserted: true });

    const [stored] = await repository.listItems();
    expect(stored).toEqual({
      id: expect.any(String),
      ...item,
    });
  });

  it("reports whether a YouTube video already exists", async () => {
    const repository = new InMemoryCatalogRepository();
    const catalog = createSupabaseRefreshCatalogPort(repository);
    const item = vettedItem();

    await expect(catalog.hasVideo(item.youtubeVideoId)).resolves.toBe(false);
    await catalog.upsertItem(item);
    await expect(catalog.hasVideo(item.youtubeVideoId)).resolves.toBe(true);
  });

  it("keeps the repository-owned id when the same video is upserted again", async () => {
    const repository = new InMemoryCatalogRepository();
    const catalog = createSupabaseRefreshCatalogPort(repository);
    const item = vettedItem();

    await catalog.upsertItem(item);
    const [first] = await repository.listItems();
    await expect(
      catalog.upsertItem({ ...item, tldr: "Updated after a later analysis." }),
    ).resolves.toEqual({ inserted: false });

    const [updated] = await repository.listItems();
    expect(updated.id).toBe(first.id);
    expect(updated.tldr).toBe("Updated after a later analysis.");
  });

  it("uses the shared repository run as an atomic lock and releases it on completion", async () => {
    const repository = new InMemoryCatalogRepository();
    const first = createSupabaseRefreshCatalogPort(repository);
    const second = createSupabaseRefreshCatalogPort(repository);
    const startedAt = "2026-07-11T15:30:00.000Z";

    const runId = await first.createRun({ startedAt });
    await expect(second.createRun({ startedAt })).rejects.toMatchObject({
      code: "REFRESH_IN_PROGRESS",
    });

    await first.completeRun({
      runId,
      status: "completed",
      counts: { discovered: 1, analyzed: 1, kept: 1, rejected: 0, duplicate: 0 },
      completedAt: "2026-07-11T15:31:00.000Z",
    });

    await expect(second.createRun({ startedAt })).resolves.toEqual(expect.any(String));
  });
});
