import { describe, expect, it, vi } from "vitest";

import { createGeminiScorecardSynthesizer } from "./gemini-scorecard-synthesizer";

describe("Gemini scorecard synthesizer", () => {
  it("requests grounded prose without delegating the deterministic Cap Score", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: {
                      text: "The guarantee is contradicted by regulator guidance.",
                      claimIds: ["claim-1"],
                    },
                    hypeFindings: [
                      {
                        id: "hype-1",
                        phrase: "cannot lose",
                        category: "guarantee",
                        severity: "high",
                        explanation: "The phrase removes real investment risk.",
                        claimId: "claim-1",
                      },
                    ],
                    nextActions: [
                      {
                        id: "action-1",
                        label: "Read the risk guidance",
                        description: "Compare the claim with FINRA's cited guidance.",
                        evidenceId: "evidence-1",
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
    const synthesizer = createGeminiScorecardSynthesizer({
      apiKey: "test-key",
      fetch,
    });

    const result = await synthesizer.synthesize({
      transcript: [
        {
          timestampSeconds: 4,
          text: "Buy now because you cannot lose on this stock.",
        },
      ],
      verifications: [
        {
          claim: {
            id: "claim-1",
            text: "You cannot lose on this stock.",
            kind: "factual",
            checkable: true,
          },
          verdict: "false",
          confidence: 0.99,
          explanation: "All investments carry risk.",
          evidence: [
            {
              id: "evidence-1",
              title: "Understanding investment risk",
              publisher: "FINRA",
              url: "https://www.finra.org/investors/investing/investing-basics/risk",
              trustTier: "primary",
              stance: "contradicts",
              excerpt: "All investments carry risk.",
            },
          ],
        },
      ],
      signal: new AbortController().signal,
    });

    expect(result).toMatchObject({
      summary: {
        text: expect.stringContaining("contradicted"),
        claimIds: ["claim-1"],
      },
      nextActions: [{ evidenceId: "evidence-1" }],
    });
    const request = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(request.generationConfig).toMatchObject({
      thinkingConfig: { thinkingLevel: "low" },
      responseMimeType: "application/json",
      responseJsonSchema: {
        properties: {
          summary: {
            properties: {
              text: expect.any(Object),
              claimIds: expect.any(Object),
            },
          },
          hypeFindings: {
            items: {
              properties: expect.objectContaining({
                claimId: expect.any(Object),
              }),
            },
          },
          nextActions: expect.any(Object),
        },
      },
    });
    expect(request.generationConfig.responseJsonSchema.properties).not.toHaveProperty(
      "capScore",
    );
    expect(request.contents[0].parts[0].text).toContain("evidence-1");
    expect(request.contents[0].parts[0].text).toContain("cannot lose");
  });

  it("retries 429 and retryable server failures with bounded backoff", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: { text: "No claims were verified.", claimIds: [] },
                      hypeFindings: [],
                      nextActions: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const synthesizer = createGeminiScorecardSynthesizer({
      apiKey: "test-key",
      fetch,
      sleep,
      baseBackoffMs: 25,
      maxAttempts: 3,
    });

    await expect(
      synthesizer.synthesize({
        transcript: [{ timestampSeconds: 0, text: "A transcript." }],
        verifications: [],
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ summary: { claimIds: [] } });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      25, 50,
    ]);
  });

  it("retries a transient network failure without exposing its details", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("private socket failure"))
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: { text: "No claims were verified.", claimIds: [] },
                      hypeFindings: [],
                      nextActions: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const synthesizer = createGeminiScorecardSynthesizer({
      apiKey: "test-key",
      fetch,
      sleep,
      baseBackoffMs: 10,
      maxAttempts: 2,
    });

    await expect(
      synthesizer.synthesize({
        transcript: [{ timestampSeconds: 0, text: "A transcript." }],
        verifications: [],
        signal: new AbortController().signal,
      }),
    ).resolves.toMatchObject({ summary: { claimIds: [] } });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10, expect.any(AbortSignal));
  });

  it("preserves the caller abort reason without retrying", async () => {
    const fetch = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("generic abort", "AbortError")),
            { once: true },
          );
        }),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const controller = new AbortController();
    const reason = new Error("caller stopped scorecard synthesis");
    const synthesizer = createGeminiScorecardSynthesizer({
      apiKey: "test-key",
      fetch,
      sleep,
      maxAttempts: 3,
    });

    const pending = synthesizer.synthesize({
      transcript: [{ timestampSeconds: 0, text: "A transcript." }],
      verifications: [],
      signal: controller.signal,
    });
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(fetch).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not start an attempt when the caller is already cancelled", async () => {
    const fetch = vi.fn();
    const controller = new AbortController();
    const reason = new Error("cancelled before synthesis");
    controller.abort(reason);
    const synthesizer = createGeminiScorecardSynthesizer({
      apiKey: "test-key",
      fetch,
    });

    await expect(
      synthesizer.synthesize({
        transcript: [{ timestampSeconds: 0, text: "A transcript." }],
        verifications: [],
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("gives each timed attempt a fresh owned deadline", async () => {
    vi.useFakeTimers();
    try {
      const attemptSignals: AbortSignal[] = [];
      const fetch = vi
        .fn()
        .mockImplementationOnce(
          async (_url: string | URL | Request, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              const attemptSignal = init?.signal;
              if (!attemptSignal) throw new Error("missing attempt signal");
              attemptSignals.push(attemptSignal);
              attemptSignal.addEventListener(
                "abort",
                () => reject(attemptSignal.reason),
                { once: true },
              );
            }),
        )
        .mockImplementationOnce(
          async (_url: string | URL | Request, init?: RequestInit) => {
            if (!init?.signal) throw new Error("missing attempt signal");
            attemptSignals.push(init.signal);
            return Response.json({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          summary: {
                            text: "No claims were verified.",
                            claimIds: [],
                          },
                          hypeFindings: [],
                          nextActions: [],
                        }),
                      },
                    ],
                  },
                },
              ],
            });
          },
        );
      const synthesizer = createGeminiScorecardSynthesizer({
        apiKey: "test-key",
        fetch,
        sleep: vi.fn().mockResolvedValue(undefined),
        maxAttempts: 2,
        requestTimeoutMs: 50,
      });

      const pending = synthesizer.synthesize({
        transcript: [{ timestampSeconds: 0, text: "A transcript." }],
        verifications: [],
        signal: new AbortController().signal,
      });
      await vi.advanceTimersByTimeAsync(50);

      await expect(pending).resolves.toMatchObject({
        summary: { claimIds: [] },
      });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(attemptSignals).toHaveLength(2);
      expect(attemptSignals[0]).not.toBe(attemptSignals[1]);
      expect(attemptSignals[0].aborted).toBe(true);
      expect(attemptSignals[1].aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops retrying after the configured attempt bound", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const synthesizer = createGeminiScorecardSynthesizer({
      apiKey: "test-key",
      fetch,
      sleep,
      baseBackoffMs: 20,
      maxAttempts: 3,
    });

    await expect(
      synthesizer.synthesize({
        transcript: [{ timestampSeconds: 0, text: "A transcript." }],
        verifications: [],
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      name: "ScorecardNarrativeRequestError",
      code: "SCORECARD_NARRATIVE_UNAVAILABLE",
      retryable: true,
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      20, 40,
    ]);
  });

  it.each([
    ["non-retryable response", new Response(null, { status: 400 })],
    ["malformed success", Response.json({ candidates: [] })],
  ])("returns a safe error for a %s", async (_label, response) => {
    const fetch = vi.fn().mockResolvedValue(response);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const synthesizer = createGeminiScorecardSynthesizer({
      apiKey: "test-key",
      fetch,
      sleep,
      maxAttempts: 3,
    });

    await expect(
      synthesizer.synthesize({
        transcript: [{ timestampSeconds: 0, text: "A transcript." }],
        verifications: [],
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({
      name: "ScorecardNarrativeRequestError",
      code: "SCORECARD_NARRATIVE_UNAVAILABLE",
      message: "Gemini could not synthesize the scorecard narrative.",
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });
});
