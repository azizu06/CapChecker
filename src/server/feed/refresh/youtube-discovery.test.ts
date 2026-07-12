import { describe, expect, it, vi } from "vitest";

import {
  createFakeYouTubeDiscovery,
  createYouTubeDiscovery,
  parseIsoDuration,
} from "./youtube-discovery";
import type { DiscoveredVideo } from "./ports";

describe("parseIsoDuration", () => {
  it.each([
    ["PT4M13S", 253],
    ["PT59S", 59],
    ["PT1H2M3S", 3723],
    ["PT10M", 600],
    ["", 0],
    ["garbage", 0],
  ])("parses %s to %d seconds", (value, expected) => {
    expect(parseIsoDuration(value)).toBe(expected);
  });
});

const searchBody = {
  items: [{ id: { videoId: "vid-1" } }, { id: { videoId: "vid-2" } }],
};

const videosBody = {
  items: [
    {
      id: "vid-1",
      snippet: {
        title: "Index funds explained",
        description: "Invest in an ETF.",
        channelTitle: "Plain Finance",
        thumbnails: { high: { url: "https://i.ytimg.com/vi/vid-1/hq.jpg" } },
      },
      contentDetails: { duration: "PT4M" },
      status: { embeddable: true, privacyStatus: "public", uploadStatus: "processed" },
    },
  ],
};

describe("createYouTubeDiscovery", () => {
  it("searches then enriches, mapping videos into candidates", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(searchBody))
      .mockResolvedValueOnce(Response.json(videosBody));

    const discovery = createYouTubeDiscovery({
      apiKey: "yt-key",
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
    });

    const candidates = await discovery.discover({
      limit: 5,
      signal: new AbortController().signal,
    });

    expect(candidates).toEqual<DiscoveredVideo[]>([
      {
        youtubeVideoId: "vid-1",
        url: "https://www.youtube.com/watch?v=vid-1",
        title: "Index funds explained",
        description: "Invest in an ETF.",
        channelTitle: "Plain Finance",
        thumbnailUrl: "https://i.ytimg.com/vi/vid-1/hq.jpg",
        durationSeconds: 240,
        embeddable: true,
        privacyStatus: "public",
        uploadStatus: "processed",
        ageRestricted: false,
      },
    ]);

    const [searchUrl] = fetch.mock.calls[0] as [URL];
    expect(searchUrl.searchParams.get("videoEmbeddable")).toBe("true");
    expect(searchUrl.searchParams.get("videoDuration")).toBe("short");
    expect(searchUrl.searchParams.get("safeSearch")).toBe("strict");
    expect(searchUrl.searchParams.get("key")).toBe("yt-key");
  });

  it("surfaces a sanitized retryable error on quota failure", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    const discovery = createYouTubeDiscovery({
      apiKey: "yt-key",
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
    });

    await expect(
      discovery.discover({ limit: 5, signal: new AbortController().signal }),
    ).rejects.toMatchObject({
      name: "RefreshError",
      code: "YOUTUBE_UNAVAILABLE",
      retryable: true,
    });
  });

  it("retries bounded 429 and 5xx responses before succeeding", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json(searchBody))
      .mockResolvedValueOnce(Response.json(videosBody));
    const discovery = createYouTubeDiscovery({
      apiKey: "yt-key",
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
      retryBaseDelayMs: 0,
    });

    await expect(
      discovery.discover({ limit: 5, signal: new AbortController().signal }),
    ).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("retries a network failure before succeeding", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(Response.json(searchBody))
      .mockResolvedValueOnce(Response.json(videosBody));
    const discovery = createYouTubeDiscovery({
      apiKey: "yt-key",
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
      retryBaseDelayMs: 0,
    });

    await expect(
      discovery.discover({ limit: 5, signal: new AbortController().signal }),
    ).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("stops after the configured retry budget is exhausted", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    const discovery = createYouTubeDiscovery({
      apiKey: "yt-key",
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
      maxAttempts: 2,
      retryBaseDelayMs: 0,
    });

    await expect(
      discovery.discover({ limit: 5, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "YOUTUBE_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries timed-out requests only within the configured budget", async () => {
    const fetch = vi.fn((_url: URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
          once: true,
        });
      }),
    );
    const discovery = createYouTubeDiscovery({
      apiKey: "yt-key",
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
      requestTimeoutMs: 5,
      maxAttempts: 2,
      retryBaseDelayMs: 0,
    });

    await expect(
      discovery.discover({ limit: 5, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "YOUTUBE_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("preserves the caller's exact abort reason without retrying", async () => {
    const reason = new DOMException("user left", "AbortError");
    const controller = new AbortController();
    controller.abort(reason);
    const fetch = vi.fn((_url: URL, init?: RequestInit) =>
      Promise.reject(init?.signal?.reason),
    );
    const discovery = createYouTubeDiscovery({
      apiKey: "yt-key",
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
      retryBaseDelayMs: 0,
    });

    await expect(
      discovery.discover({ limit: 5, signal: controller.signal }),
    ).rejects.toBe(reason);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when search finds nothing", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ items: [] }));
    const discovery = createYouTubeDiscovery({
      apiKey: "yt-key",
      fetch: fetch as typeof globalThis.fetch,
      now: () => 0,
    });
    await expect(
      discovery.discover({ limit: 5, signal: new AbortController().signal }),
    ).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("createFakeYouTubeDiscovery", () => {
  it("replays candidates sliced to the limit", async () => {
    const candidates = [1, 2, 3].map((n) => ({
      youtubeVideoId: `v${n}`,
    })) as unknown as DiscoveredVideo[];
    const discovery = createFakeYouTubeDiscovery({ candidates });
    const result = await discovery.discover({
      limit: 2,
      signal: new AbortController().signal,
    });
    expect(result).toHaveLength(2);
  });

  it("throws the injected error to simulate quota exhaustion", async () => {
    const discovery = createFakeYouTubeDiscovery({
      candidates: [],
      throwError: () => new Error("quota"),
    });
    await expect(
      discovery.discover({ limit: 5, signal: new AbortController().signal }),
    ).rejects.toThrow("quota");
  });
});
