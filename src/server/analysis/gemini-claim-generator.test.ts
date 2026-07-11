import { describe, expect, it, vi } from "vitest";

import {
  ClaimGenerationError,
  createGeminiClaimGenerator,
} from "./gemini-claim-generator";

describe("Gemini claim generator", () => {
  it("requests schema-constrained video output and returns the JSON payload", async () => {
    const extraction = {
      transcript: [
        { timestampSeconds: 2, text: "AAPL revenue rose 5% in Q1." },
      ],
      claims: [
        {
          id: "claim-1",
          text: "AAPL revenue rose 5% in Q1.",
          timestampSeconds: 2,
          kind: "factual",
          checkable: true,
          quant: {
            ticker: "AAPL",
            metric: "revenue growth",
            value: "5%",
            period: "Q1",
          },
        },
      ],
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(extraction) }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const generator = createGeminiClaimGenerator({
      apiKey: "test-api-key",
      fetch,
    });
    const signal = new AbortController().signal;

    await expect(
      generator.generate({
        file: {
          name: "files/demo",
          uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
          mimeType: "video/mp4",
        },
        signal,
      }),
    ).resolves.toEqual(extraction);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": "test-api-key",
      },
      signal: expect.any(AbortSignal),
    });
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0]).toEqual({
      fileData: {
        fileUri:
          "https://generativelanguage.googleapis.com/v1beta/files/demo",
        mimeType: "video/mp4",
      },
    });
    expect(body.contents[0].parts[1].text).toContain(
      "Do not turn opinions into checkable claims",
    );
    expect(body.contents[0].parts[1].text).toContain(
      "unique sequential id",
    );
    expect(body.contents[0].parts[1].text).toContain(
      "Preserve each quantitative field that is present",
    );
    expect(body.contents[0].parts[1].text).toContain(
      "Every claim containing a number",
    );
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        required: ["transcript", "claims"],
      },
    });
    const quantSchema =
      body.generationConfig.responseJsonSchema.properties.claims.items.anyOf[0]
        .properties.quant;
    expect(quantSchema.required).toBeUndefined();
    expect(quantSchema.anyOf).toEqual([
      { required: ["ticker"] },
      { required: ["metric"] },
      { required: ["value"] },
      { required: ["period"] },
    ]);
  });

  it("rejects malformed JSON without exposing raw model output", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: "```json\nnot valid JSON\n```" }],
            },
          },
        ],
      }),
    );
    const generator = createGeminiClaimGenerator({
      apiKey: "test-api-key",
      fetch,
    });

    const error = await generator
      .generate({
        file: {
          name: "files/demo",
          uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
          mimeType: "video/mp4",
        },
        signal: new AbortController().signal,
      })
      .catch((caught: unknown) => caught);

    expect(error).toEqual(
      new ClaimGenerationError({
        code: "MALFORMED_CLAIM_EXTRACTION",
        message: "Gemini returned an invalid transcript or claim structure.",
        retryable: true,
      }),
    );
    expect(String(error)).not.toContain("not valid JSON");
  });

  it("rejects a response with no JSON candidate as malformed output", async () => {
    const generator = createGeminiClaimGenerator({
      apiKey: "test-api-key",
      fetch: vi.fn().mockResolvedValue(Response.json({ candidates: [] })),
    });

    await expect(
      generator.generate({
        file: {
          name: "files/demo",
          uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
          mimeType: "video/mp4",
        },
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      new ClaimGenerationError({
        code: "MALFORMED_CLAIM_EXTRACTION",
        message: "Gemini returned an invalid transcript or claim structure.",
        retryable: true,
      }),
    );
  });

  it("rejects a non-JSON response envelope as malformed output", async () => {
    const generator = createGeminiClaimGenerator({
      apiKey: "test-api-key",
      fetch: vi.fn().mockResolvedValue(
        new Response("not a Gemini response", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    });

    await expect(
      generator.generate({
        file: {
          name: "files/demo",
          uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
          mimeType: "video/mp4",
        },
        signal: new AbortController().signal,
      }),
    ).rejects.toEqual(
      new ClaimGenerationError({
        code: "MALFORMED_CLAIM_EXTRACTION",
        message: "Gemini returned an invalid transcript or claim structure.",
        retryable: true,
      }),
    );
  });

  it("classifies a rate limit as a safe retryable request failure", async () => {
    const generator = createGeminiClaimGenerator({
      apiKey: "super-secret-api-key",
      fetch: vi.fn().mockResolvedValue(
        new Response("private upstream details", { status: 429 }),
      ),
    });

    const error = await generator
      .generate({
        file: {
          name: "files/demo",
          uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
          mimeType: "video/mp4",
        },
        signal: new AbortController().signal,
      })
      .catch((caught: unknown) => caught);

    expect(error).toEqual(
      new ClaimGenerationError({
        code: "GEMINI_CLAIM_REQUEST_FAILED",
        message: "Gemini could not extract claims from this video. Try again.",
        retryable: true,
      }),
    );
    expect(String(error)).not.toContain("private upstream details");
    expect(String(error)).not.toContain("super-secret-api-key");
  });

  it("bounds a stalled generation request with a safe timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      );
      const generator = createGeminiClaimGenerator({
        apiKey: "test-api-key",
        fetch: fetch as typeof globalThis.fetch,
        requestTimeoutMs: 1_000,
      });

      const request = generator.generate({
        file: {
          name: "files/demo",
          uri: "https://generativelanguage.googleapis.com/v1beta/files/demo",
          mimeType: "video/mp4",
        },
        signal: new AbortController().signal,
      });
      const expectation = expect(request).rejects.toEqual(
        new ClaimGenerationError({
          code: "GEMINI_CLAIM_REQUEST_TIMEOUT",
          message: "Gemini took too long to extract claims. Try again.",
          retryable: true,
        }),
      );

      await vi.advanceTimersByTimeAsync(1_001);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
