import { describe, expect, it } from "vitest";

import { FIXTURE_CATALOG_ITEMS } from "@/fixtures/feed";

import {
  InMemoryCatalogRepository,
  catalogItemToRow,
  createFixtureCatalogRepository,
  rowToCatalogItem,
  rowToRefreshRun,
  type CatalogItemRow,
  type RefreshRunRow,
} from "./catalog-repository";

const [firstItem, secondItem] = FIXTURE_CATALOG_ITEMS;

describe("row <-> CatalogItem mapping", () => {
  it("round-trips a catalog item through the row shape", () => {
    const row = catalogItemToRow(firstItem) as CatalogItemRow;
    expect(rowToCatalogItem(row)).toEqual(firstItem);
  });

  it("normalizes timestamptz strings to ISO on the way out", () => {
    const row = catalogItemToRow(secondItem) as CatalogItemRow;
    const naiveTimestamp = { ...row, analyzed_at: "2026-07-11 15:00:00+00" };
    expect(rowToCatalogItem(naiveTimestamp).analyzedAt).toBe(
      "2026-07-11T15:00:00.000Z",
    );
  });

  it("maps a refresh-run row into the camelCase contract", () => {
    const row: RefreshRunRow = {
      id: "refresh-run-9",
      status: "failed",
      discovered_count: 4,
      analyzed_count: 2,
      kept_count: 0,
      rejected_count: 2,
      duplicate_count: 1,
      started_at: "2026-07-11T15:00:00.000Z",
      completed_at: "2026-07-11T15:02:00.000Z",
      error: "network timeout",
    };

    expect(rowToRefreshRun(row)).toEqual({
      id: "refresh-run-9",
      status: "failed",
      discoveredCount: 4,
      analyzedCount: 2,
      keptCount: 0,
      rejectedCount: 2,
      duplicateCount: 1,
      startedAt: "2026-07-11T15:00:00.000Z",
      completedAt: "2026-07-11T15:02:00.000Z",
      error: "network timeout",
    });
  });
});

describe("InMemoryCatalogRepository", () => {
  it("seeds from fixtures and returns items newest-first", async () => {
    const repository = createFixtureCatalogRepository();
    const items = await repository.listItems();
    expect(items).toHaveLength(FIXTURE_CATALOG_ITEMS.length);
    expect(items.map((item) => item.id)).toEqual(
      [...FIXTURE_CATALOG_ITEMS]
        .sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt))
        .map((item) => item.id),
    );
  });

  it("filters by category and by case-insensitive search", async () => {
    const repository = new InMemoryCatalogRepository(FIXTURE_CATALOG_ITEMS);

    const byCategory = await repository.listItems({
      category: firstItem.category,
    });
    expect(byCategory.every((item) => item.category === firstItem.category)).toBe(
      true,
    );

    const bySearch = await repository.listItems({
      search: firstItem.title.slice(0, 6).toUpperCase(),
    });
    expect(bySearch.some((item) => item.id === firstItem.id)).toBe(true);

    const noMatch = await repository.listItems({ search: "zzz-nothing-here" });
    expect(noMatch).toHaveLength(0);
  });

  it("looks items up by id and returns null when missing", async () => {
    const repository = new InMemoryCatalogRepository(FIXTURE_CATALOG_ITEMS);
    expect(await repository.getItem(firstItem.id)).toEqual(firstItem);
    expect(await repository.getItem("does-not-exist")).toBeNull();
  });

  it("reports insert on first upsert and update on the second", async () => {
    const repository = new InMemoryCatalogRepository();
    expect(await repository.upsertItem(firstItem)).toEqual({ inserted: true });
    expect(await repository.upsertItem(firstItem)).toEqual({ inserted: false });
    expect(await repository.listItems()).toHaveLength(1);
  });

  it("creates and updates refresh runs", async () => {
    const repository = new InMemoryCatalogRepository();
    const run = await repository.createRefreshRun({ discoveredCount: 3 });
    expect(run.status).toBe("running");
    expect(run.discoveredCount).toBe(3);

    const completed = await repository.updateRefreshRun(run.id, {
      status: "completed",
      keptCount: 1,
      completedAt: "2026-07-11T15:05:00.000Z",
    });
    expect(completed.status).toBe("completed");
    expect(completed.keptCount).toBe(1);
    expect(completed.completedAt).toBe("2026-07-11T15:05:00.000Z");
  });
});
