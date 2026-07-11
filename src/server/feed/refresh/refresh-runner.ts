import { deriveTldr, screenCandidate } from "./candidate-filter";
import {
  REFRESH_IN_PROGRESS,
  RefreshError,
  catalogWriteError,
} from "./errors";
import type { AcceptedSummary, RefreshEvent, RefreshStage } from "./events";
import { evaluateReliability } from "./reliability-gate";
import type {
  AnalyzeVideo,
  NewCatalogItem,
  RefreshCatalogPort,
  RefreshCounts,
  YouTubeDiscoveryPort,
} from "./ports";

export type RefreshRunnerDependencies = {
  discovery: YouTubeDiscoveryPort;
  analyze: AnalyzeVideo;
  catalog: RefreshCatalogPort;
  /** Wall-clock source for run/analysis timestamps. Injected for determinism. */
  now?: () => Date;
  /** Max candidates discovered per refresh (capped at 5). */
  candidateLimit?: number;
};

const zeroCounts = (): RefreshCounts => ({
  discovered: 0,
  analyzed: 0,
  kept: 0,
  rejected: 0,
  duplicate: 0,
});

const toRefreshError = (cause: unknown): RefreshError =>
  cause instanceof RefreshError ? cause : catalogWriteError();

/**
 * Orchestrates one feed refresh end to end. Guarantees:
 * - Single-flight: only one refresh runs at a time per runner instance; a
 *   concurrent attempt is rejected with a clear message and never creates a run.
 * - Truthful counts: discovered / analyzed / kept / rejected / duplicate.
 * - Idempotent: acceptance goes through `upsertItem`, so a repeat of the same
 *   video updates in place instead of duplicating.
 * - Safe failure: any external failure (quota, rate limit, timeout, catalog
 *   write) marks the run failed and leaves existing catalog rows untouched,
 *   surfacing a sanitized, retryable message.
 */
export function createRefreshRunner(dependencies: RefreshRunnerDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const candidateLimit = Math.min(Math.max(dependencies.candidateLimit ?? 5, 1), 5);
  let running = false;

  return {
    isRunning: () => running,

    async *run(signal: AbortSignal): AsyncGenerator<RefreshEvent> {
      if (running) {
        yield errorEvent(REFRESH_IN_PROGRESS);
        return;
      }
      running = true;

      const counts = zeroCounts();
      let runId: string | undefined;

      try {
        yield stage("starting", "Preparing the feed refresh");

        try {
          runId = await dependencies.catalog.createRun({
            startedAt: now().toISOString(),
          });
        } catch {
          throw catalogWriteError();
        }

        yield stage("discovering", "Searching YouTube for a new candidate");
        const discovered = await dependencies.discovery.discover({
          limit: candidateLimit,
          signal,
        });
        counts.discovered = discovered.length;

        let accepted: AcceptedSummary | null = null;

        for (const video of discovered) {
          if (signal.aborted) break;

          yield stage("screening", `Screening "${displayTitle(video.title)}"`);
          const screened = screenCandidate(video);
          if (!screened.ok) {
            counts.rejected += 1;
            continue;
          }

          let isDuplicate: boolean;
          try {
            isDuplicate = await dependencies.catalog.hasVideo(video.youtubeVideoId);
          } catch {
            throw catalogWriteError();
          }
          if (isDuplicate) {
            counts.duplicate += 1;
            continue;
          }

          yield stage("analyzing", `Analyzing "${displayTitle(video.title)}"`);
          counts.analyzed += 1;
          const scorecard = await dependencies.analyze({
            url: video.url,
            signal,
          });

          const analyzedAt = now().toISOString();
          const tldr = deriveTldr(scorecard.summary);
          const verdict = evaluateReliability({
            scorecard,
            tldr,
            category: screened.category,
            analyzedAt,
          });
          if (!verdict.accepted) {
            counts.rejected += 1;
            continue;
          }

          const item: NewCatalogItem = {
            youtubeVideoId: video.youtubeVideoId,
            url: video.url,
            title: video.title,
            channelTitle: video.channelTitle,
            thumbnailUrl: video.thumbnailUrl,
            durationSeconds: video.durationSeconds,
            category: screened.category,
            tldr,
            capScore: scorecard.capScore,
            capLabel: scorecard.capLabel,
            scorecard,
            analyzedAt,
          };

          yield stage("saving", "Saving the vetted candidate to the feed");
          let inserted: boolean;
          try {
            ({ inserted } = await dependencies.catalog.upsertItem(item));
          } catch {
            throw catalogWriteError();
          }
          counts.kept += 1;
          accepted = {
            youtubeVideoId: item.youtubeVideoId,
            title: item.title,
            category: item.category,
            capScore: item.capScore,
            tldr: item.tldr,
            inserted,
          };
          break;
        }

        if (runId) {
          await safeCompleteRun(dependencies.catalog, {
            runId,
            status: "completed",
            counts,
            completedAt: now().toISOString(),
          });
        }

        yield stage(
          "done",
          accepted
            ? "Added a newly vetted video to the feed"
            : "No new candidate cleared the reliability gate this time",
        );
        yield { type: "complete", status: "completed", counts, accepted };
      } catch (cause) {
        const error = toRefreshError(cause);
        if (runId) {
          await safeCompleteRun(dependencies.catalog, {
            runId,
            status: "failed",
            counts,
            completedAt: now().toISOString(),
            errorCode: error.code,
          });
        }
        yield errorEvent(error);
      } finally {
        running = false;
      }
    },
  };
}

const displayTitle = (title: string) => {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "candidate";
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
};

const stage = (stageName: RefreshStage, message: string): RefreshEvent => ({
  type: "stage",
  stage: stageName,
  message,
});

const errorEvent = (error: RefreshError): RefreshEvent => ({
  type: "error",
  error: { code: error.code, message: error.message, retryable: error.retryable },
});

/** Best-effort run finalization: never let a bookkeeping write mask the run. */
const safeCompleteRun = async (
  catalog: RefreshCatalogPort,
  input: Parameters<RefreshCatalogPort["completeRun"]>[0],
) => {
  try {
    await catalog.completeRun(input);
  } catch {
    // Swallow: the primary outcome is already decided and streamed.
  }
};
