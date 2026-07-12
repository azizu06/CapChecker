import type { Scorecard } from "@/domain/analysis";

/**
 * Narrow ports owned by Lane A (issue #28). Lane B owns the concrete
 * `src/domain/feed.ts` schemas and `catalog-repository.ts`; the orchestrator
 * wires Lane B's repository into `RefreshCatalogPort` at integration time
 * (see `catalog-port-adapter.ts`). Keep these camelCase field names stable —
 * they are the contract both lanes agreed on.
 */

export const FINANCE_CATEGORIES = [
  "investing",
  "credit",
  "taxes",
  "budgeting",
  "retirement",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

/** A row we want to insert/update in the vetted catalog. */
export type NewCatalogItem = {
  youtubeVideoId: string;
  url: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSeconds: number;
  category: FinanceCategory;
  tldr: string;
  capScore: number;
  capLabel: Scorecard["capLabel"];
  scorecard: Scorecard;
  analyzedAt: string;
};

export type RefreshCounts = {
  discovered: number;
  analyzed: number;
  kept: number;
  rejected: number;
  duplicate: number;
};

export type RefreshRunStatus = "completed" | "failed";

/**
 * Narrow catalog port. Lane B's `CatalogRepository` (keyed on unique
 * `youtube_video_id`) satisfies this via the thin adapter. Everything here is
 * idempotent: `upsertItem` reports whether the row was newly inserted.
 */
export interface RefreshCatalogPort {
  hasVideo(youtubeVideoId: string): Promise<boolean>;
  upsertItem(item: NewCatalogItem): Promise<{ inserted: boolean }>;
  createRun(input: { startedAt: string }): Promise<string>;
  completeRun(input: {
    runId: string;
    status: RefreshRunStatus;
    counts: RefreshCounts;
    completedAt: string;
    errorCode?: string;
  }): Promise<void>;
  releaseRun(input: { runId: string }): Promise<void>;
}

/** A raw candidate returned by YouTube discovery, before filtering. */
export type DiscoveredVideo = {
  youtubeVideoId: string;
  url: string;
  title: string;
  description: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSeconds: number;
  embeddable: boolean;
  /** YouTube `status.privacyStatus`, e.g. "public". */
  privacyStatus: string;
  /** YouTube `status.uploadStatus`, e.g. "processed". */
  uploadStatus: string;
  /** YouTube `contentDetails.contentRating.ytRating`, "ytAgeRestricted" when age-gated. */
  ageRestricted: boolean;
};

/**
 * Discovery boundary. The real implementation calls the YouTube Data API v3;
 * the deterministic fake replays a fixed candidate list for tests/fixture mode.
 */
export interface YouTubeDiscoveryPort {
  discover(input: {
    limit: number;
    signal: AbortSignal;
  }): Promise<DiscoveredVideo[]>;
}

/**
 * Analysis boundary. Reuses the existing CapCheck analyzer — never a second
 * scoring implementation. Given a public YouTube URL, resolves the final
 * `Scorecard` (or throws a sanitized error on failure/timeout).
 */
export type AnalyzeVideo = (input: {
  url: string;
  signal: AbortSignal;
}) => Promise<Scorecard>;
