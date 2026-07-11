import { z } from "zod";

const DEFAULT_BASE_URL = "https://finnhub.io";

const FinnhubQuoteSchema = z.object({
  c: z.number().finite(),
  d: z.number().finite(),
  dp: z.number().finite(),
  h: z.number().finite(),
  l: z.number().finite(),
  o: z.number().finite(),
  pc: z.number().finite(),
  t: z.number().int().nonnegative(),
});

export type StockData = {
  ticker: string;
  metric?: string;
  period?: string;
  quote: {
    current: number;
    change: number;
    percentChange: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    timestamp: string;
  };
  source: {
    title: string;
    publisher: string;
    url: string;
    trustTier: "high";
  };
};

export class MarketDataError extends Error {
  readonly code = "MARKET_DATA_UNAVAILABLE";
  readonly retryable = true;

  constructor() {
    super("Current market data is unavailable.");
    this.name = "MarketDataError";
  }
}

type FinnhubMarketDataOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  baseBackoffMs?: number;
  maxAttempts?: number;
};

const sleepWithSignal = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
  });

export function createFinnhubMarketData({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetch: fetchImpl = globalThis.fetch,
  now = () => new Date(),
  sleep = sleepWithSignal,
  baseBackoffMs = 250,
  maxAttempts = 3,
}: FinnhubMarketDataOptions) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("maxAttempts must be a positive integer");
  }

  return {
    async getStockData({
      ticker,
      metric,
      period,
      signal,
    }: {
      ticker: string;
      metric?: string;
      period?: string;
      signal: AbortSignal;
    }): Promise<StockData> {
      const symbol = ticker.trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
        throw new MarketDataError();
      }

      const url = new URL("/api/v1/quote", baseUrl);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("token", apiKey);

      let response: Response | undefined;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          response = await fetchImpl(url, { signal });
        } catch (cause) {
          if (signal.aborted) throw cause;
          throw new MarketDataError();
        }
        if (response.status !== 429 || attempt === maxAttempts) break;
        await sleep(baseBackoffMs * 2 ** (attempt - 1), signal);
      }
      if (!response?.ok) throw new MarketDataError();

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new MarketDataError();
      }
      const parsed = FinnhubQuoteSchema.safeParse(payload);
      if (!parsed.success) throw new MarketDataError();

      const quote = parsed.data;
      const timestamp = quote.t > 0 ? new Date(quote.t * 1_000) : now();
      return {
        ticker: symbol,
        metric,
        period,
        quote: {
          current: quote.c,
          change: quote.d,
          percentChange: quote.dp,
          high: quote.h,
          low: quote.l,
          open: quote.o,
          previousClose: quote.pc,
          timestamp: timestamp.toISOString(),
        },
        source: {
          title: "Stock quote",
          publisher: "Finnhub",
          url: "https://finnhub.io/docs/api/quote",
          trustTier: "high",
        },
      };
    },
  };
}
