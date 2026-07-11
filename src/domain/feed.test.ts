import { describe, expect, it } from "vitest";

import { FIXTURE_CATALOG_ITEMS } from "../fixtures/feed";
import { CatalogItemSchema, RefreshRunSchema } from "./feed";

describe("CatalogItemSchema", () => {
  const [item] = FIXTURE_CATALOG_ITEMS;

  it("accepts every fixture catalog item through the shared contract", () => {
    for (const fixture of FIXTURE_CATALOG_ITEMS) {
      expect(CatalogItemSchema.parse(fixture)).toEqual(fixture);
    }
  });

  it("rejects a category outside the approved set", () => {
    expect(
      CatalogItemSchema.safeParse({ ...item, category: "crypto" }).success,
    ).toBe(false);
  });

  it("rejects a cap score that drifts from the embedded scorecard", () => {
    expect(
      CatalogItemSchema.safeParse({ ...item, capScore: item.capScore + 1 })
        .success,
    ).toBe(false);
  });

  it("rejects a cap label that drifts from the embedded scorecard", () => {
    expect(
      CatalogItemSchema.safeParse({ ...item, capLabel: "full-of-cap" }).success,
    ).toBe(false);
  });

  it("rejects a non-HTTP thumbnail URL", () => {
    expect(
      CatalogItemSchema.safeParse({
        ...item,
        thumbnailUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("RefreshRunSchema", () => {
  it("accepts a completed run with nullable completion fields", () => {
    const run = {
      id: "refresh-run-1",
      status: "completed" as const,
      discoveredCount: 8,
      analyzedCount: 6,
      keptCount: 1,
      rejectedCount: 5,
      duplicateCount: 2,
      startedAt: "2026-07-11T15:00:00.000Z",
      completedAt: "2026-07-11T15:04:00.000Z",
      error: null,
    };

    expect(RefreshRunSchema.parse(run)).toEqual(run);
  });

  it("rejects an unknown status", () => {
    expect(
      RefreshRunSchema.safeParse({
        id: "refresh-run-1",
        status: "paused",
        discoveredCount: 0,
        analyzedCount: 0,
        keptCount: 0,
        rejectedCount: 0,
        duplicateCount: 0,
        startedAt: "2026-07-11T15:00:00.000Z",
        completedAt: null,
        error: null,
      }).success,
    ).toBe(false);
  });
});
