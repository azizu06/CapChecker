import { z } from "zod";

import type { Verification } from "@/domain/analysis";

import type { ClaimExtraction } from "./claim-extraction";
import type { StockData } from "./finnhub-market-data";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-3.5-flash";

type ExtractedClaim = ClaimExtraction["claims"][number];
type VerificationDraft = Omit<Verification, "claim">;

const VerificationDraftSchema = z.object({
  verdict: z.enum(["true", "mostly-true", "unverifiable", "false"]),
  confidence: z.coerce.number().min(0).max(1),
  explanation: z.string().min(1),
});

const FunctionCallSchema = z.object({
  id: z.string().min(1),
  name: z.literal("get_stock_data"),
  args: z.object({
    ticker: z.string().min(1),
    metric: z.string().min(1).optional(),
    period: z.string().min(1).optional(),
  }),
});

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["true", "mostly-true", "unverifiable", "false"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    explanation: { type: "string" },
  },
  required: ["verdict", "confidence", "explanation"],
};

type GroundingChunk = { web?: { uri?: unknown; title?: unknown } };
type GroundingSupport = {
  groundingChunkIndices?: unknown;
  segment?: { text?: unknown };
};
type MarketData = {
  getStockData(input: {
    ticker: string;
    metric?: string;
    period?: string;
    signal: AbortSignal;
  }): Promise<StockData>;
};

export class ClaimVerificationRequestError extends Error {
  readonly code = "CLAIM_VERIFICATION_UNAVAILABLE";
  readonly retryable = true;

  constructor() {
    super("Gemini could not verify this claim with the available evidence.");
    this.name = "ClaimVerificationRequestError";
  }
}

const publisherFor = (url: string) => new URL(url).hostname.replace(/^www\./, "");

const publisherForSource = (url: string, title: string) => {
  const publisher = publisherFor(url);
  return publisher === "vertexaisearch.cloud.google.com"
    ? title.replace(/^www\./, "")
    : publisher;
};

const isHostWithin = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

const trustTierFor = (url: string) => {
  const hostname = publisherFor(url).toLowerCase().replace(/\.$/, "");
  if (
    [
      "sec.gov",
      "investor.gov",
      "federalreserve.gov",
      "bls.gov",
      "irs.gov",
      "treasury.gov",
      "finra.org",
    ].some((domain) => isHostWithin(hostname, domain))
  ) {
    return "primary" as const;
  }
  if (
    [
      "reuters.com",
      "bloomberg.com",
      "wsj.com",
      "ft.com",
      "cnbc.com",
      "finnhub.io",
      "nasdaq.com",
      "nyse.com",
      "morningstar.com",
    ].some((domain) => isHostWithin(hostname, domain))
  ) {
    return "high" as const;
  }
  return "low" as const;
};

const readCandidate = (value: unknown) => {
  if (!value || typeof value !== "object") throw new ClaimVerificationRequestError();
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") {
    throw new ClaimVerificationRequestError();
  }
  const candidate = candidates[0] as {
    content?: { parts?: unknown };
    groundingMetadata?: {
      groundingChunks?: unknown;
      groundingSupports?: unknown;
    };
  };
  const parts = candidate.content?.parts;
  if (!Array.isArray(parts)) throw new ClaimVerificationRequestError();
  const text = parts.find(
    (part) =>
      part &&
      typeof part === "object" &&
      typeof (part as { text?: unknown }).text === "string",
  ) as { text: string } | undefined;
  if (!text) throw new ClaimVerificationRequestError();

  let draft: unknown;
  try {
    draft = JSON.parse(text.text);
  } catch {
    throw new ClaimVerificationRequestError();
  }
  const parsed = VerificationDraftSchema.safeParse(draft);
  if (!parsed.success) throw new ClaimVerificationRequestError();

  const chunks = Array.isArray(candidate.groundingMetadata?.groundingChunks)
    ? (candidate.groundingMetadata.groundingChunks as GroundingChunk[])
    : [];
  const supports = Array.isArray(candidate.groundingMetadata?.groundingSupports)
    ? (candidate.groundingMetadata.groundingSupports as GroundingSupport[])
    : [];
  const supportedIndices = new Set(
    supports.flatMap((support) =>
      Array.isArray(support.groundingChunkIndices)
        ? support.groundingChunkIndices.filter(
            (index): index is number => Number.isInteger(index) && index >= 0,
          )
        : [],
    ),
  );

  return { draft: parsed.data, chunks, supportedIndices };
};

const readGroundedTurn = (value: unknown) => {
  if (!value || typeof value !== "object") throw new ClaimVerificationRequestError();
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") {
    throw new ClaimVerificationRequestError();
  }
  const candidate = candidates[0] as {
    content?: unknown;
    groundingMetadata?: {
      groundingChunks?: unknown;
      groundingSupports?: unknown;
    };
  };
  if (!candidate.content || typeof candidate.content !== "object") {
    throw new ClaimVerificationRequestError();
  }
  const chunks = Array.isArray(candidate.groundingMetadata?.groundingChunks)
    ? (candidate.groundingMetadata.groundingChunks as GroundingChunk[])
    : [];
  const supports = Array.isArray(candidate.groundingMetadata?.groundingSupports)
    ? (candidate.groundingMetadata.groundingSupports as GroundingSupport[])
    : [];
  const supportedIndices = new Set(
    supports.flatMap((support) =>
      Array.isArray(support.groundingChunkIndices)
        ? support.groundingChunkIndices.filter(
            (index): index is number => Number.isInteger(index) && index >= 0,
          )
        : [],
    ),
  );
  if (chunks.length === 0 || supportedIndices.size === 0) {
    throw new ClaimVerificationRequestError();
  }
  return {
    modelContent: candidate.content,
    chunks,
    supports,
    supportedIndices,
  };
};

const readFunctionCall = (value: unknown) => {
  if (!value || typeof value !== "object") throw new ClaimVerificationRequestError();
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") {
    throw new ClaimVerificationRequestError();
  }
  const content = (candidates[0] as { content?: unknown }).content;
  if (!content || typeof content !== "object") throw new ClaimVerificationRequestError();
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) throw new ClaimVerificationRequestError();
  const callPart = parts.find(
    (part) => part && typeof part === "object" && "functionCall" in part,
  ) as { functionCall?: unknown } | undefined;
  const parsed = FunctionCallSchema.safeParse(callPart?.functionCall);
  if (!parsed.success) throw new ClaimVerificationRequestError();
  return { modelContent: content, call: parsed.data };
};

const functionDeclaration = {
  name: "get_stock_data",
  description:
    "Gets a current Finnhub stock quote for a ticker so a quantitative financial claim can be checked.",
  parameters: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Exchange ticker, such as AAPL" },
      metric: { type: "string", description: "Metric named in the claim" },
      period: { type: "string", description: "Period named in the claim" },
    },
    required: ["ticker"],
  },
};

const normalizeQuantLabel = (value: string | undefined) =>
  value?.trim().toLowerCase().replace(/[\s_-]+/g, " ");

const currentQuoteMetrics = new Set([
  "current price",
  "current share price",
  "current stock price",
  "latest price",
  "latest share price",
  "latest stock price",
  "real time price",
  "current quote",
  "latest quote",
]);

const quoteMetrics = new Set([
  "price",
  "share price",
  "stock price",
  "quote",
  "market price",
  "trading price",
]);

const currentPeriods = new Set([
  "current",
  "now",
  "today",
  "latest",
  "present",
  "real time",
]);

const isCurrentQuoteClaim = (claim: ExtractedClaim) => {
  if (!claim.quant?.ticker) return false;
  const metric = normalizeQuantLabel(claim.quant.metric);
  const period = normalizeQuantLabel(claim.quant.period);
  if (!metric) return false;
  if (period && !currentPeriods.has(period)) return false;
  return (
    currentQuoteMetrics.has(metric) ||
    (quoteMetrics.has(metric) && Boolean(period && currentPeriods.has(period)))
  );
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

export function createGeminiClaimVerifier({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  model = DEFAULT_MODEL,
  fetch: fetchImpl = globalThis.fetch,
  marketData,
  sleep = sleepWithSignal,
  baseBackoffMs = 300,
  maxAttempts = 3,
  requestTimeoutMs = 30_000,
}: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
  marketData?: MarketData;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  baseBackoffMs?: number;
  maxAttempts?: number;
  requestTimeoutMs?: number;
}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("maxAttempts must be a positive integer");
  }

  const request = async (body: unknown, signal: AbortSignal) => {
    let response: Response | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const timeout = new AbortController();
      const timer = setTimeout(
        () => timeout.abort(new DOMException("Request timed out", "TimeoutError")),
        requestTimeoutMs,
      );
      try {
        response = await fetchImpl(
          `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.any([signal, timeout.signal]),
          },
        );
      } catch (cause) {
        if (signal.aborted) throw cause;
        throw new ClaimVerificationRequestError();
      } finally {
        clearTimeout(timer);
      }
      if (response.status !== 429 || attempt === maxAttempts) break;
      await sleep(baseBackoffMs * 2 ** (attempt - 1), signal);
    }
    if (!response?.ok) throw new ClaimVerificationRequestError();
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new ClaimVerificationRequestError();
    }
  };

  const verifyWithSearch = async (
    claim: ExtractedClaim,
    signal: AbortSignal,
  ): Promise<VerificationDraft> => {
    const userContent = {
      role: "user",
      parts: [
        {
          text: `Use Google Search to find current authoritative evidence for this claim. Summarize the evidence and any conflicts, and identify the most authoritative sources. Claim: ${claim.text}`,
        },
      ],
    };
    const groundedPayload = await request(
      {
        contents: [userContent],
        tools: [{ googleSearch: {} }],
      },
      signal,
    );
    const { modelContent, chunks, supports, supportedIndices } =
      readGroundedTurn(groundedPayload);
    const classificationPayload = await request(
      {
        contents: [
          userContent,
          modelContent,
          {
            role: "user",
            parts: [
              {
                text: "Classify the claim from the grounded evidence above. Return only the requested JSON. Use unverifiable when the evidence is insufficient or conflicting.",
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema,
        },
      },
      signal,
    );
    const { draft } = readCandidate(classificationPayload);
    const excerpts = new Map<number, string>();
    for (const support of supports) {
      if (!Array.isArray(support.groundingChunkIndices)) continue;
      const excerpt =
        typeof support.segment?.text === "string" && support.segment.text.trim()
          ? support.segment.text.trim()
          : draft.explanation;
      for (const index of support.groundingChunkIndices) {
        if (Number.isInteger(index) && index >= 0 && !excerpts.has(index as number)) {
          excerpts.set(index as number, excerpt);
        }
      }
    }
    const evidence = [...supportedIndices].flatMap((chunkIndex, citationIndex) => {
      const web = chunks[chunkIndex]?.web;
      if (typeof web?.uri !== "string" || typeof web.title !== "string") return [];
      let publisher: string;
      try {
        publisher = publisherForSource(web.uri, web.title);
      } catch {
        return [];
      }
      return [
        {
          id: `${claim.id}-source-${citationIndex + 1}`,
          title: web.title,
          publisher,
          url: web.uri,
          trustTier: trustTierFor(web.uri),
          stance: "context" as const,
          excerpt: excerpts.get(chunkIndex) ?? draft.explanation,
        },
      ];
    });
    if (draft.verdict !== "unverifiable" && evidence.length === 0) {
      throw new ClaimVerificationRequestError();
    }
    return {
      verdict: draft.verdict,
      confidence: draft.confidence,
      explanation: draft.explanation,
      evidence,
    };
  };

  const verifyWithMarketData = async (
    claim: ExtractedClaim,
    signal: AbortSignal,
  ): Promise<VerificationDraft> => {
    if (!claim.quant?.ticker || !marketData) {
      return verifyWithSearch(claim, signal);
    }
    const userContent = {
      role: "user",
      parts: [
        {
          text: `Verify this quantitative financial claim using get_stock_data: ${claim.text}`,
        },
      ],
    };
    const firstPayload = await request(
      {
        contents: [userContent],
        tools: [{ functionDeclarations: [functionDeclaration] }],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["get_stock_data"],
          },
        },
      },
      signal,
    );
    const { modelContent, call } = readFunctionCall(firstPayload);
    if (call.args.ticker.toUpperCase() !== claim.quant.ticker.toUpperCase()) {
      throw new ClaimVerificationRequestError();
    }
    const stockData = await marketData.getStockData({
      ticker: call.args.ticker,
      metric: call.args.metric,
      period: call.args.period,
      signal,
    });
    const finalPayload = await request(
      {
        contents: [
          userContent,
          modelContent,
          {
            role: "user",
            parts: [
              {
                functionResponse: {
                  id: call.id,
                  name: call.name,
                  response: { output: stockData },
                },
              },
            ],
          },
        ],
        tools: [{ functionDeclarations: [functionDeclaration] }],
        toolConfig: { functionCallingConfig: { mode: "NONE" } },
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema,
        },
      },
      signal,
    );
    const { draft } = readCandidate(finalPayload);
    const stance =
      draft.verdict === "false"
        ? ("contradicts" as const)
        : draft.verdict === "unverifiable"
          ? ("context" as const)
          : ("supports" as const);
    return {
      verdict: draft.verdict,
      confidence: draft.confidence,
      explanation: draft.explanation,
      evidence: [
        {
          id: `${claim.id}-source-1`,
          title: stockData.source.title,
          publisher: stockData.source.publisher,
          url: stockData.source.url,
          trustTier: stockData.source.trustTier,
          stance,
          excerpt: `Observed request-specific Finnhub quote for ${stockData.ticker}: current ${stockData.quote.current}; previous close ${stockData.quote.previousClose}; change ${stockData.quote.change} (${stockData.quote.percentChange}%). Retrieved ${stockData.quote.timestamp}. The linked documentation describes the endpoint but does not reproduce this request-specific value.`,
        },
      ],
    };
  };

  return {
    async verifyClaim(
      claim: ExtractedClaim,
      { signal }: { signal: AbortSignal },
    ): Promise<VerificationDraft> {
      if (!isCurrentQuoteClaim(claim) || !marketData) {
        return verifyWithSearch(claim, signal);
      }
      try {
        return await verifyWithMarketData(claim, signal);
      } catch (cause) {
        if (signal.aborted) throw cause;
        return verifyWithSearch(claim, signal);
      }
    },
  };
}
