import { describe, expect, it, vi } from "vitest";

import type { Scorecard } from "@/domain/analysis";
import { DEMO_SCORECARDS } from "@/fixtures/scorecards";
import { InMemoryCatalogRepository } from "@/server/feed/catalog-repository";

import { createSupabaseRefreshCatalogPort } from "./catalog-port-adapter";
import { youTubeQuotaError } from "./errors";
import type { RefreshEvent } from "./events";
import { createInMemoryCatalog } from "./in-memory-catalog";
import type {
  AnalyzeVideo,
  DiscoveredVideo,
  NewCatalogItem,
  YouTubeDiscoveryPort,
} from "./ports";
import { createRefreshRunner } from "./refresh-runner";

const candidate = (overrides: Partial<DiscoveredVideo> = {}): DiscoveredVideo => ({
  youtubeVideoId: "vid-index",
  url: "https://www.youtube.com/watch?v=vid-index",
  title: "Index funds explained for beginners",
  description: "Invest in a low-cost ETF for the long term.",
  channelTitle: "Plain Finance",
  thumbnailUrl: "https://i.ytimg.com/vi/vid-index/hq.jpg",
  durationSeconds: 200,
  embeddable: true,
  privacyStatus: "public",
  uploadStatus: "processed",
  ageRestricted: false,
  ...overrides,
});

const staticDiscovery = (candidates: DiscoveredVideo[]): YouTubeDiscoveryPort => ({
  async discover({ limit }) {
    return candidates.slice(0, limit);
  },
});

const analyzeWith = (scorecard: Scorecard): AnalyzeVideo =>
  vi.fn(async () => scorecard);

const NOW = () => new Date("2026-07-11T15:30:00.000Z");

const drain = async (generator: AsyncGenerator<RefreshEvent>) => {
  const events: RefreshEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
};

const seededItem = (): NewCatalogItem => ({
  youtubeVideoId: "existing-vid",
  url: "https://www.youtube.com/watch?v=existing-vid",
  title: "Existing card",
  channelTitle: "Channel",
  thumbnailUrl: "",
  durationSeconds: 120,
  category: "investing",
  tldr: "Existing",
  capScore: 5,
  capLabel: "no-cap",
  scorecard: DEMO_SCORECARDS.legitimate,
  analyzedAt: "2026-07-10T00:00:00.000Z",
});

describe("refresh runner", () => {
  it("does nothing when the caller signal is already aborted", async () => {
    const catalog = createInMemoryCatalog();
    const runner = createRefreshRunner({
      discovery: staticDiscovery([candidate()]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });
    const controller = new AbortController();
    controller.abort(new DOMException("request already closed", "AbortError"));

    const events = await drain(runner.run(controller.signal));

    expect(events).toEqual([]);
    expect(catalog.runs).toEqual([]);
    expect(catalog.items.size).toBe(0);
    expect(runner.isRunning()).toBe(false);
  });

  it("accepts one vetted candidate and upserts it idempotently", async () => {
    const catalog = createInMemoryCatalog();
    const runner = createRefreshRunner({
      discovery: staticDiscovery([candidate()]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));
    const complete = events.find((event) => event.type === "complete");

    expect(complete).toMatchObject({
      type: "complete",
      status: "completed",
      counts: { discovered: 1, analyzed: 1, kept: 1, rejected: 0, duplicate: 0 },
    });
    expect(complete?.type === "complete" && complete.accepted).toMatchObject({
      youtubeVideoId: "vid-index",
      category: "investing",
      inserted: true,
    });
    expect(catalog.items.get("vid-index")?.tldr).toBeTruthy();
    expect(catalog.runs[0]).toMatchObject({ status: "completed" });
  });

  it("rejects a candidate that fails the reliability gate", async () => {
    const catalog = createInMemoryCatalog();
    const runner = createRefreshRunner({
      discovery: staticDiscovery([candidate()]),
      analyze: analyzeWith(DEMO_SCORECARDS.mixed), // has a false verdict
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));
    const complete = events.find((event) => event.type === "complete");

    expect(complete).toMatchObject({
      type: "complete",
      counts: { discovered: 1, analyzed: 1, kept: 0, rejected: 1, duplicate: 0 },
    });
    expect(complete?.type === "complete" && complete.accepted).toBeNull();
    expect(catalog.items.size).toBe(0);
  });

  it("skips a candidate already in the catalog as a duplicate", async () => {
    const existing = candidate();
    const catalog = createInMemoryCatalog([
      { ...seededItem(), youtubeVideoId: existing.youtubeVideoId },
    ]);
    const analyze = analyzeWith(DEMO_SCORECARDS.legitimate);
    const runner = createRefreshRunner({
      discovery: staticDiscovery([existing]),
      analyze,
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));
    const complete = events.find((event) => event.type === "complete");

    expect(complete).toMatchObject({
      counts: { discovered: 1, analyzed: 0, kept: 0, rejected: 0, duplicate: 1 },
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("counts an upsert race as a duplicate instead of a kept item", async () => {
    const catalog = createInMemoryCatalog();
    catalog.hasVideo = async () => false;
    catalog.upsertItem = async () => ({ inserted: false });
    const runner = createRefreshRunner({
      discovery: staticDiscovery([candidate()]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));
    const complete = events.find((event) => event.type === "complete");

    expect(complete).toMatchObject({
      counts: { discovered: 1, analyzed: 1, kept: 0, rejected: 0, duplicate: 1 },
      accepted: null,
    });
  });

  it("fails safely on YouTube quota failure without touching existing rows", async () => {
    const catalog = createInMemoryCatalog([seededItem()]);
    const runner = createRefreshRunner({
      discovery: {
        async discover() {
          throw youTubeQuotaError();
        },
      },
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));
    const error = events.find((event) => event.type === "error");

    expect(error).toMatchObject({
      type: "error",
      error: { code: "YOUTUBE_UNAVAILABLE", retryable: true },
    });
    // Existing catalog untouched, run recorded as failed.
    expect(catalog.items.size).toBe(1);
    expect(catalog.items.has("existing-vid")).toBe(true);
    expect(catalog.runs[0]).toMatchObject({ status: "failed" });
  });

  it("emits a safe failure and marks the run failed when completion persistence fails", async () => {
    const catalog = createInMemoryCatalog();
    const completeRun = catalog.completeRun.bind(catalog);
    catalog.completeRun = vi
      .fn<typeof catalog.completeRun>()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockImplementation(completeRun);
    const runner = createRefreshRunner({
      discovery: staticDiscovery([]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));

    expect(events.some((event) => event.type === "complete")).toBe(false);
    expect(events.at(-1)).toMatchObject({
      type: "error",
      error: { code: "CATALOG_WRITE_FAILED", retryable: true },
    });
    expect(catalog.runs[0]).toMatchObject({
      status: "failed",
      errorCode: "CATALOG_WRITE_FAILED",
    });
  });

  it("truthfully preserves an accepted item and failed audit row when completion fails", async () => {
    const catalog = createInMemoryCatalog();
    const completeRun = catalog.completeRun.bind(catalog);
    const releaseRun = vi.spyOn(catalog, "releaseRun");
    catalog.completeRun = vi.fn(async (input) => {
      if (input.status === "completed") {
        throw new Error("completion write failed");
      }
      await completeRun(input);
    });
    const runner = createRefreshRunner({
      discovery: staticDiscovery([candidate()]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));
    const terminal = events.at(-1);

    expect(terminal).toMatchObject({
      type: "error",
      error: { code: "REFRESH_FINALIZATION_FAILED", retryable: true },
    });
    expect(terminal?.type === "error" ? terminal.error.message : "").toContain(
      "saved",
    );
    expect(catalog.items.has("vid-index")).toBe(true);
    expect(catalog.runs[0]).toMatchObject({
      status: "failed",
      errorCode: "REFRESH_FINALIZATION_FAILED",
    });
    expect(releaseRun).not.toHaveBeenCalled();
  });

  it("releases the run lock when both finalization writes fail", async () => {
    const baseCatalog = createInMemoryCatalog();
    const releaseRun = vi.fn(async ({ runId }: { runId: string }) => {
      const index = baseCatalog.runs.findIndex((run) => run.id === runId);
      if (index >= 0) baseCatalog.runs.splice(index, 1);
    });
    const catalog = {
      ...baseCatalog,
      completeRun: vi.fn().mockRejectedValue(new Error("database unavailable")),
      releaseRun,
    };
    const runner = createRefreshRunner({
      discovery: staticDiscovery([]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));

    expect(events.at(-1)).toMatchObject({
      type: "error",
      error: { code: "CATALOG_WRITE_FAILED" },
    });
    expect(releaseRun).toHaveBeenCalledWith({ runId: "run-1" });
    expect(baseCatalog.runs).toHaveLength(0);
  });

  it("never leaks internals in a failure message", async () => {
    const catalog = createInMemoryCatalog();
    const runner = createRefreshRunner({
      discovery: {
        async discover() {
          throw new Error("YOUTUBE_API_KEY=secret at /internal/path.ts:42");
        },
      },
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));
    const error = events.find((event) => event.type === "error");
    const message = error?.type === "error" ? error.error.message : "";

    expect(message).not.toContain("secret");
    expect(message).not.toContain("/internal/path.ts");
    expect(message).not.toContain("YOUTUBE_API_KEY");
  });

  it("rejects a concurrent refresh with a clear single-flight message", async () => {
    const catalog = createInMemoryCatalog();
    const runner = createRefreshRunner({
      discovery: staticDiscovery([candidate()]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const first = runner.run(new AbortController().signal);
    // Advance the first run past run-row creation so it holds the lock.
    await first.next(); // "starting"
    await first.next(); // creates run row, then "discovering"
    expect(runner.isRunning()).toBe(true);

    const second = await drain(runner.run(new AbortController().signal));
    expect(second).toEqual([
      {
        type: "error",
        error: {
          code: "REFRESH_IN_PROGRESS",
          message: expect.stringContaining("already running"),
          retryable: true,
        },
      },
    ]);
    // The concurrent attempt must not have opened its own run row.
    expect(catalog.runs).toHaveLength(1);

    await drain(first); // let the first run finish and release the lock
    expect(runner.isRunning()).toBe(false);
  });

  it("rejects concurrent refreshes across runners that share repository state", async () => {
    const repository = new InMemoryCatalogRepository();
    const dependencies = {
      discovery: staticDiscovery([candidate()]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      now: NOW,
    };
    const firstRunner = createRefreshRunner({
      ...dependencies,
      catalog: createSupabaseRefreshCatalogPort(repository),
    });
    const secondRunner = createRefreshRunner({
      ...dependencies,
      catalog: createSupabaseRefreshCatalogPort(repository),
    });
    const first = firstRunner.run(new AbortController().signal);
    await first.next();
    await first.next();

    const second = await drain(secondRunner.run(new AbortController().signal));

    expect(second).toEqual([
      { type: "stage", stage: "starting", message: "Preparing the feed refresh" },
      {
        type: "error",
        error: {
          code: "REFRESH_IN_PROGRESS",
          message: expect.stringContaining("already running"),
          retryable: true,
        },
      },
    ]);
    await drain(first);
  });

  it("allows a fresh refresh after a prior failure", async () => {
    const catalog = createInMemoryCatalog();
    const discovery: YouTubeDiscoveryPort = {
      discover: vi
        .fn<YouTubeDiscoveryPort["discover"]>()
        .mockRejectedValueOnce(youTubeQuotaError())
        .mockResolvedValueOnce([candidate()]),
    };
    const runner = createRefreshRunner({
      discovery,
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const firstEvents = await drain(runner.run(new AbortController().signal));
    expect(firstEvents.some((event) => event.type === "error")).toBe(true);
    expect(runner.isRunning()).toBe(false);

    const secondEvents = await drain(runner.run(new AbortController().signal));
    const complete = secondEvents.find((event) => event.type === "complete");
    expect(complete).toMatchObject({ counts: { kept: 1 } });
    expect(catalog.items.has("vid-index")).toBe(true);
  });

  it("releases single-flight after caller cancellation", async () => {
    const catalog = createInMemoryCatalog();
    const analyze = vi
      .fn<AnalyzeVideo>()
      .mockImplementationOnce(({ signal }) =>
        new Promise<Scorecard>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
      )
      .mockResolvedValue(DEMO_SCORECARDS.legitimate);
    const runner = createRefreshRunner({
      discovery: staticDiscovery([candidate()]),
      analyze,
      catalog,
      now: NOW,
    });
    const controller = new AbortController();
    const first = runner.run(controller.signal);

    await first.next();
    await first.next();
    await first.next();
    await first.next();
    const blocked = first.next();
    const reason = new DOMException("reader stopped", "AbortError");
    controller.abort(reason);
    await expect(blocked).rejects.toBe(reason);

    expect(runner.isRunning()).toBe(false);
    expect(catalog.runs[0]).toMatchObject({
      status: "failed",
      errorCode: "REFRESH_CANCELLED",
    });
    const retry = await drain(runner.run(new AbortController().signal));
    expect(retry.at(-1)).toMatchObject({ type: "complete", counts: { kept: 1 } });
  });

  it("preserves cancellation at the candidate boundary without a false complete", async () => {
    const catalog = createInMemoryCatalog();
    const controller = new AbortController();
    const reason = new DOMException("request closed", "AbortError");
    const runner = createRefreshRunner({
      discovery: {
        async discover() {
          controller.abort(reason);
          return [candidate()];
        },
      },
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });
    const events: RefreshEvent[] = [];
    let caught: unknown;

    try {
      for await (const event of runner.run(controller.signal)) events.push(event);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(reason);
    expect(events.some((event) => event.type === "complete")).toBe(false);
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(catalog.items.size).toBe(0);
    expect(catalog.runs[0]).toMatchObject({
      status: "failed",
      errorCode: "REFRESH_CANCELLED",
    });
    expect(runner.isRunning()).toBe(false);
  });

  it("completes with no acceptance when candidates are exhausted", async () => {
    const catalog = createInMemoryCatalog();
    const runner = createRefreshRunner({
      discovery: staticDiscovery([
        candidate({ durationSeconds: 9 * 60 }), // too long -> screened out
      ]),
      analyze: analyzeWith(DEMO_SCORECARDS.legitimate),
      catalog,
      now: NOW,
    });

    const events = await drain(runner.run(new AbortController().signal));
    const complete = events.find((event) => event.type === "complete");
    expect(complete).toMatchObject({
      counts: { discovered: 1, analyzed: 0, kept: 0, rejected: 1, duplicate: 0 },
    });
    expect(complete?.type === "complete" && complete.accepted).toBeNull();
  });
});
