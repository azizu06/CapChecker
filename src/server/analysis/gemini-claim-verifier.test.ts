import { describe, expect, it, vi } from "vitest";

import { createGeminiClaimVerifier } from "./gemini-claim-verifier";

describe("Gemini claim verifier", () => {
  it("aborts a stalled Gemini request at its implementation-owned deadline", async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      const caller = new AbortController();
      const fetch = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            requestSignal = init?.signal ?? undefined;
            requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), {
              once: true,
            });
          }),
      );
      const verifier = createGeminiClaimVerifier({
        apiKey: "test-gemini-key",
        fetch: fetch as typeof globalThis.fetch,
        requestTimeoutMs: 1_000,
      });

      const request = verifier.verifyClaim(
        {
          id: "claim-timeout",
          text: "A stalled claim.",
          timestampSeconds: 0,
          kind: "factual",
          checkable: true,
        },
        { signal: caller.signal },
      );
      const outcome = request.catch((caught: unknown) => caught);
      await vi.advanceTimersByTimeAsync(1_001);
      const deadlineAborted = requestSignal?.aborted ?? false;
      if (!deadlineAborted) caller.abort(new DOMException("cleanup", "AbortError"));
      const error = await outcome;

      expect(deadlineAborted).toBe(true);
      expect(error).toEqual(
        expect.objectContaining({
          name: "ClaimVerificationRequestError",
          code: "CLAIM_VERIFICATION_UNAVAILABLE",
          retryable: true,
        }),
      );
      expect(caller.signal.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves the caller abort reason instead of converting it to a timeout", async () => {
    const caller = new AbortController();
    const reason = new DOMException("caller stopped verification", "AbortError");
    const fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const verifier = createGeminiClaimVerifier({
      apiKey: "test-gemini-key",
      fetch: fetch as typeof globalThis.fetch,
      requestTimeoutMs: 60_000,
    });

    const request = verifier.verifyClaim(
      {
        id: "claim-abort",
        text: "A cancelled claim.",
        timestampSeconds: 0,
        kind: "factual",
        checkable: true,
      },
      { signal: caller.signal },
    );
    caller.abort(reason);

    await expect(request).rejects.toBe(reason);
  });

  it("grounds a general claim with Search-supported displayable citations", async () => {
    const signedSearchTurn = {
      role: "model",
      parts: [
        {
          text: "The SEC filing says revenue increased by five percent.",
          thoughtSignature: "signed-search-turn",
        },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({
        candidates: [
          {
            content: signedSearchTurn,
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: "https://www.sec.gov/Archives/edgar/data/example",
                    title: "SEC filing",
                  },
                },
              ],
              groundingSupports: [
                {
                  segment: { text: "Revenue increased by five percent." },
                  groundingChunkIndices: [0],
                },
              ],
            },
          },
        ],
      }))
      .mockResolvedValueOnce(Response.json({
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  text: JSON.stringify({
                    verdict: "true",
                    confidence: 0.94,
                    explanation: "The SEC filing reports the same increase.",
                  }),
                },
              ],
            },
          },
        ],
      }));
    const verifier = createGeminiClaimVerifier({
      apiKey: "test-gemini-key",
      fetch,
    });

    await expect(
      verifier.verifyClaim(
        {
          id: "claim-1",
          text: "The company increased revenue by five percent.",
          timestampSeconds: 2,
          kind: "factual",
          checkable: true,
        },
        { signal: new AbortController().signal },
      ),
    ).resolves.toEqual({
      verdict: "true",
      confidence: 0.94,
      explanation: "The SEC filing reports the same increase.",
      evidence: [
        {
          id: "claim-1-source-1",
          title: "SEC filing",
          publisher: "sec.gov",
          url: "https://www.sec.gov/Archives/edgar/data/example",
          trustTier: "primary",
          stance: "context",
          excerpt: "Revenue increased by five percent.",
        },
      ],
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-3.5-flash:generateContent");
    const body = JSON.parse(String(init.body));
    expect(body.tools).toEqual([{ googleSearch: {} }]);
    expect(body.contents[0].parts[0].text).toContain(
      "The company increased revenue by five percent.",
    );
    expect(body.contents[0].parts[0].text).toContain("Use Google Search");
    expect(body.generationConfig).toBeUndefined();
    const classificationBody = JSON.parse(String(fetch.mock.calls[1][1]?.body));
    expect(classificationBody.contents[1]).toEqual(signedSearchTurn);
    expect(classificationBody.generationConfig.responseJsonSchema.required).toEqual([
      "verdict",
      "confidence",
      "explanation",
    ]);
  });

  it("does not grant authority from hostile page titles or substring hostnames", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Two pages repeat the claim." }],
              },
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: "https://unknown.example/article",
                      title: "SEC.gov official filing",
                    },
                  },
                  {
                    web: {
                      uri: "https://sec.gov.attacker.example/article",
                      title: "Unknown mirror",
                    },
                  },
                ],
                groundingSupports: [
                  {
                    segment: { text: "The pages repeat the claim." },
                    groundingChunkIndices: [0, 1],
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      verdict: "mostly-true",
                      confidence: 0.5,
                      explanation: "The claim is repeated but lacks an authoritative source.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    const verifier = createGeminiClaimVerifier({
      apiKey: "test-gemini-key",
      fetch,
    });

    const result = await verifier.verifyClaim(
      {
        id: "claim-hostile-title",
        text: "A regulatory claim.",
        timestampSeconds: 0,
        kind: "factual",
        checkable: true,
      },
      { signal: new AbortController().signal },
    );

    expect(result.evidence.map(({ trustTier }) => trustTier)).toEqual([
      "low",
      "low",
    ]);
  });

  it("uses get_stock_data for an explicitly current quote-compatible claim", async () => {
    const signedModelTurn = {
      role: "model",
      parts: [
        { text: "I will check the current quote." },
        {
          functionCall: {
            id: "call-quote-1",
            name: "get_stock_data",
            args: { ticker: "AAPL", metric: "price", period: "current" },
          },
          thoughtSignature: "encrypted-thought-signature",
        },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ candidates: [{ content: signedModelTurn }] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      verdict: "true",
                      confidence: 0.88,
                      explanation: "The current quote is above the claimed level.",
                      citations: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    const stockData = {
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
        title: "Finnhub quote API documentation",
        publisher: "Finnhub",
        url: "https://finnhub.io/docs/api/quote",
        trustTier: "high" as const,
      },
    };
    const getStockData = vi.fn().mockResolvedValue(stockData);
    const verifier = createGeminiClaimVerifier({
      apiKey: "test-gemini-key",
      fetch,
      marketData: { getStockData },
    });

    await expect(
      verifier.verifyClaim(
        {
          id: "claim-1",
          text: "AAPL trades above $230.",
          timestampSeconds: 2,
          kind: "factual",
          checkable: true,
          quant: { ticker: "AAPL", metric: "price", value: "$230", period: "current" },
        },
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({
      verdict: "true",
      evidence: [
        {
          title: "Finnhub quote API documentation",
          publisher: "Finnhub",
          trustTier: "high",
          url: "https://finnhub.io/docs/api/quote",
          excerpt: expect.stringContaining(
            "The linked documentation describes the endpoint but does not reproduce this request-specific value.",
          ),
        },
      ],
    });

    expect(getStockData).toHaveBeenCalledWith({
      ticker: "AAPL",
      metric: "price",
      period: "current",
      signal: expect.any(AbortSignal),
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(firstBody.tools[0].functionDeclarations[0].name).toBe("get_stock_data");
    expect(
      firstBody.tools[0].functionDeclarations[0].parameters.additionalProperties,
    ).toBeUndefined();
    const secondBody = JSON.parse(String(fetch.mock.calls[1][1]?.body));
    expect(secondBody.contents[1]).toEqual(signedModelTurn);
    expect(secondBody.contents[2]).toEqual({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: "call-quote-1",
            name: "get_stock_data",
            response: { output: stockData },
          },
        },
      ],
    });
  });

  it("routes an unsupported ticker metric and historical period directly to Search", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "The filing reports quarterly revenue." }],
              },
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: "https://www.sec.gov/Archives/edgar/data/example",
                      title: "Quarterly filing",
                    },
                  },
                ],
                groundingSupports: [
                  {
                    segment: { text: "Quarterly revenue was reported in the filing." },
                    groundingChunkIndices: [0],
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      verdict: "true",
                      confidence: 0.9,
                      explanation: "The quarterly filing supports the revenue claim.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    const getStockData = vi.fn();
    const verifier = createGeminiClaimVerifier({
      apiKey: "test-gemini-key",
      fetch,
      marketData: { getStockData },
    });

    await expect(
      verifier.verifyClaim(
        {
          id: "claim-revenue",
          text: "AAPL revenue rose in Q1 2026.",
          timestampSeconds: 10,
          kind: "factual",
          checkable: true,
          quant: { ticker: "AAPL", metric: "revenue", period: "Q1 2026" },
        },
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({
      verdict: "true",
      evidence: [expect.objectContaining({ publisher: "sec.gov" })],
    });

    expect(getStockData).not.toHaveBeenCalled();
    const firstBody = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(firstBody.tools).toEqual([{ googleSearch: {} }]);
  });

  it("falls back to Search grounding when quantitative market data is unavailable", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      id: "call-1",
                      name: "get_stock_data",
                      args: { ticker: "NVDA" },
                    },
                    thoughtSignature: "signature-1",
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      verdict: "mostly-true",
                      confidence: 0.7,
                      explanation: "A current exchange page supports the direction.",
                      citations: [
                        {
                          groundingChunkIndex: 0,
                          stance: "supports",
                          excerpt: "The shares traded above the cited level.",
                        },
                      ],
                    }),
                  },
                ],
              },
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: "https://www.nasdaq.com/market-activity/stocks/nvda",
                      title: "NVDA market activity",
                    },
                  },
                ],
                groundingSupports: [{ groundingChunkIndices: [0] }],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      verdict: "mostly-true",
                      confidence: 0.7,
                      explanation: "A current exchange page supports the direction.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    const verifier = createGeminiClaimVerifier({
      apiKey: "test-gemini-key",
      fetch,
      marketData: {
        getStockData: vi.fn().mockRejectedValue(new Error("private Finnhub failure")),
      },
    });

    await expect(
      verifier.verifyClaim(
        {
          id: "claim-2",
          text: "NVDA trades above $100.",
          timestampSeconds: 4,
          kind: "factual",
          checkable: true,
          quant: {
            ticker: "NVDA",
            metric: "price",
            value: "$100",
            period: "current",
          },
        },
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({
      verdict: "mostly-true",
      evidence: [{ publisher: "nasdaq.com" }],
    });

    const fallbackBody = JSON.parse(String(fetch.mock.calls[1][1]?.body));
    expect(fallbackBody.tools).toEqual([{ googleSearch: {} }]);
  });

  it("backs off and retries bounded Gemini rate limits", async () => {
    const grounded = {
      candidates: [
        {
          content: {
            role: "model",
            parts: [
              {
                text: "One source discusses the private company's revenue.",
              },
            ],
          },
          groundingMetadata: {
            groundingChunks: [
              {
                web: {
                  uri: "https://example.com/company-report",
                  title: "Company report",
                },
              },
            ],
            groundingSupports: [
              {
                segment: { text: "The source does not disclose enough detail." },
                groundingChunkIndices: [0],
              },
            ],
          },
        },
      ],
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(Response.json(grounded))
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      verdict: "unverifiable",
                      confidence: 0.2,
                      explanation: "The available sources are insufficient.",
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const verifier = createGeminiClaimVerifier({
      apiKey: "test-gemini-key",
      fetch,
      sleep,
      baseBackoffMs: 300,
      maxAttempts: 3,
    });

    await expect(
      verifier.verifyClaim(
        {
          id: "claim-3",
          text: "A private company doubled revenue.",
          timestampSeconds: 8,
          kind: "factual",
          checkable: true,
        },
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({ verdict: "unverifiable" });

    expect(fetch).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenNthCalledWith(1, 300, expect.any(AbortSignal));
    expect(sleep).toHaveBeenNthCalledWith(2, 600, expect.any(AbortSignal));
  });
});
