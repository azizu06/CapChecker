import { describe, expect, it, vi } from "vitest";

import { createFinnhubMarketData } from "./finnhub-market-data";

describe("Finnhub market data", () => {
  it("returns a normalized quote with a displayable source citation", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        c: 231.59,
        d: 2.14,
        dp: 0.9327,
        h: 233.12,
        l: 228.01,
        o: 229.4,
        pc: 229.45,
        t: 1783785600,
      }),
    );
    const marketData = createFinnhubMarketData({
      apiKey: "test-finnhub-key",
      fetch,
      now: () => new Date("2026-07-11T16:00:00.000Z"),
    });

    await expect(
      marketData.getStockData({
        ticker: "aapl",
        metric: "price",
        period: "current",
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      ticker: "AAPL",
      metric: "price",
      period: "current",
      quote: {
        current: 231.59,
        change: 2.14,
        percentChange: 0.9327,
        high: 233.12,
        low: 228.01,
        open: 229.4,
        previousClose: 229.45,
        timestamp: "2026-07-11T16:00:00.000Z",
      },
      source: {
        title: "Stock quote",
        publisher: "Finnhub",
        url: "https://finnhub.io/docs/api/quote",
        trustTier: "high",
      },
    });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/v1/quote");
    expect(new URL(url).searchParams.get("symbol")).toBe("AAPL");
    expect(new URL(url).searchParams.get("token")).toBe("test-finnhub-key");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("backs off and retries bounded Finnhub rate limits", async () => {
    const quote = { c: 10, d: 1, dp: 10, h: 11, l: 9, o: 9, pc: 9, t: 0 };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(Response.json(quote));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const marketData = createFinnhubMarketData({
      apiKey: "test-finnhub-key",
      fetch,
      sleep,
      baseBackoffMs: 250,
      maxAttempts: 3,
    });

    await expect(
      marketData.getStockData({
        ticker: "NVDA",
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ ticker: "NVDA", quote: { current: 10 } });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 250, expect.any(AbortSignal));
    expect(sleep).toHaveBeenNthCalledWith(2, 500, expect.any(AbortSignal));
  });
});
