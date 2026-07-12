import { z } from "zod";

import { youTubeQuotaError } from "./errors";
import type { DiscoveredVideo, YouTubeDiscoveryPort } from "./ports";

const DEFAULT_BASE_URL = "https://www.googleapis.com";

/** Small rotating finance query set for search.list. */
export const DEFAULT_DISCOVERY_QUERIES: readonly string[] = [
  "index funds explained",
  "credit score tips",
  "roth ira basics",
  "how to budget money",
  "tax deductions explained",
  "compound interest explained",
];

const SearchResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.object({ videoId: z.string().min(1) }).optional(),
      }),
    )
    .optional(),
});

const VideosResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        snippet: z
          .object({
            title: z.string().optional(),
            description: z.string().optional(),
            channelTitle: z.string().optional(),
            thumbnails: z.record(z.string(), z.object({ url: z.string() }).partial()).optional(),
          })
          .optional(),
        contentDetails: z
          .object({
            duration: z.string().optional(),
            contentRating: z.object({ ytRating: z.string().optional() }).optional(),
          })
          .optional(),
        status: z
          .object({
            embeddable: z.boolean().optional(),
            privacyStatus: z.string().optional(),
            uploadStatus: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

/** Parse an ISO-8601 duration (e.g. "PT4M13S") into whole seconds. */
export const parseIsoDuration = (value: string | undefined): number => {
  if (!value) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value.trim());
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return (
    Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0)
  );
};

const pickThumbnail = (
  thumbnails: Record<string, { url?: string }> | undefined,
): string => {
  if (!thumbnails) return "";
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbnails[key]?.url;
    if (url) return url;
  }
  const first = Object.values(thumbnails).find((entry) => entry.url)?.url;
  return first ?? "";
};

type YouTubeDiscoveryOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => number;
  queries?: readonly string[];
  requestTimeoutMs?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
};

const waitForRetry = async (delayMs: number, signal: AbortSignal) => {
  if (signal.aborted) throw signal.reason;
  if (delayMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
};

const fetchJson = async (
  fetchImpl: typeof fetch,
  url: URL,
  signal: AbortSignal,
  requestTimeoutMs: number,
  maxAttempts: number,
  retryBaseDelayMs: number,
): Promise<unknown> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const timeout = new AbortController();
    const timer = setTimeout(
      () => timeout.abort(new DOMException("Request timed out", "TimeoutError")),
      requestTimeoutMs,
    );
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.any([signal, timeout.signal]),
      });
      if (response.ok) {
        try {
          return await response.json();
        } catch {
          throw youTubeQuotaError();
        }
      }
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) throw youTubeQuotaError();
    } catch (cause) {
      if (signal.aborted) throw signal.reason;
      if (cause instanceof Error && cause.name === "RefreshError") throw cause;
      if (attempt === maxAttempts) throw youTubeQuotaError();
    } finally {
      clearTimeout(timer);
    }
    await waitForRetry(retryBaseDelayMs * attempt, signal);
  }
  throw youTubeQuotaError();
};

/**
 * Real YouTube Data API v3 discovery. Uses a server-side `YOUTUBE_API_KEY`
 * only. search.list finds short, embeddable finance videos with strict
 * SafeSearch; videos.list then enriches with duration / embeddability /
 * status so the candidate filter can screen them. Any upstream failure
 * (quota, rate limit, timeout, malformed payload) surfaces as a single
 * sanitized, retryable error — never a raw exception.
 */
export function createYouTubeDiscovery({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetch: fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  queries = DEFAULT_DISCOVERY_QUERIES,
  requestTimeoutMs = 10_000,
  maxAttempts = 3,
  retryBaseDelayMs = 150,
}: YouTubeDiscoveryOptions): YouTubeDiscoveryPort {
  if (queries.length === 0) {
    throw new TypeError("At least one discovery query is required");
  }

  return {
    async discover({ limit, signal }) {
      const query = queries[Math.floor(now() / 60_000) % queries.length];

      const searchUrl = new URL("/youtube/v3/search", baseUrl);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("videoEmbeddable", "true");
      searchUrl.searchParams.set("videoDuration", "short");
      searchUrl.searchParams.set("safeSearch", "strict");
      searchUrl.searchParams.set("maxResults", String(Math.min(Math.max(limit, 1), 25)));
      searchUrl.searchParams.set("key", apiKey);

      const search = SearchResponseSchema.safeParse(
        await fetchJson(
          fetchImpl,
          searchUrl,
          signal,
          requestTimeoutMs,
          maxAttempts,
          retryBaseDelayMs,
        ),
      );
      if (!search.success) throw youTubeQuotaError();

      const ids = (search.data.items ?? [])
        .map((item) => item.id?.videoId)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) return [];

      const videosUrl = new URL("/youtube/v3/videos", baseUrl);
      videosUrl.searchParams.set("part", "snippet,contentDetails,status");
      videosUrl.searchParams.set("id", ids.join(","));
      videosUrl.searchParams.set("key", apiKey);

      const videos = VideosResponseSchema.safeParse(
        await fetchJson(
          fetchImpl,
          videosUrl,
          signal,
          requestTimeoutMs,
          maxAttempts,
          retryBaseDelayMs,
        ),
      );
      if (!videos.success) throw youTubeQuotaError();

      return (videos.data.items ?? []).map((item): DiscoveredVideo => {
        const snippet = item.snippet ?? {};
        const contentDetails = item.contentDetails ?? {};
        const status = item.status ?? {};
        return {
          youtubeVideoId: item.id,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          title: snippet.title ?? "",
          description: snippet.description ?? "",
          channelTitle: snippet.channelTitle ?? "",
          thumbnailUrl: pickThumbnail(snippet.thumbnails),
          durationSeconds: parseIsoDuration(contentDetails.duration),
          embeddable: status.embeddable ?? false,
          privacyStatus: status.privacyStatus ?? "",
          uploadStatus: status.uploadStatus ?? "",
          ageRestricted: contentDetails.contentRating?.ytRating === "ytAgeRestricted",
        };
      });
    },
  };
}

/**
 * Deterministic discovery for tests and fixture mode: returns a fixed, ordered
 * candidate list (optionally sliced to `limit`). Pass `throwError` to simulate
 * a quota/rate-limit failure.
 */
export function createFakeYouTubeDiscovery(options: {
  candidates: DiscoveredVideo[];
  throwError?: () => Error;
}): YouTubeDiscoveryPort {
  return {
    async discover({ limit, signal }) {
      if (signal.aborted) throw signal.reason;
      if (options.throwError) throw options.throwError();
      return options.candidates.slice(0, limit);
    },
  };
}
