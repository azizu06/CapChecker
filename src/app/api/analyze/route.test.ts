import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalysisEventSchema, type AnalysisEvent } from "@/domain/analysis";
import { DEMO_FATAL_ERROR, DEMO_SCORECARDS } from "@/fixtures/scorecards";
import { parseAnalysisStream } from "@/lib/analysis-stream";

import { createAnalyzeHandler } from "./route-handler";
import { POST } from "./route";

const ORIGINAL_MODE = process.env.CAPCHECK_ANALYSIS_MODE;
const ORIGINAL_GEMINI_KEY = process.env.GEMINI_API_KEY;
const ORIGINAL_FINNHUB_KEY = process.env.FINNHUB_KEY;

const request = (body: unknown) =>
  new Request("http://127.0.0.1:3000/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/analyze", () => {
  beforeEach(() => {
    process.env.CAPCHECK_ANALYSIS_MODE = "fixture";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (ORIGINAL_MODE === undefined) {
      delete process.env.CAPCHECK_ANALYSIS_MODE;
    } else {
      process.env.CAPCHECK_ANALYSIS_MODE = ORIGINAL_MODE;
    }
    if (ORIGINAL_GEMINI_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = ORIGINAL_GEMINI_KEY;
    if (ORIGINAL_FINNHUB_KEY === undefined) delete process.env.FINNHUB_KEY;
    else process.env.FINNHUB_KEY = ORIGINAL_FINNHUB_KEY;
  });

  it.each([
    [{}, "A video URL is required."],
    [{ url: "" }, "A video URL is required."],
    [{ url: "javascript:alert(1)" }, "Enter a valid HTTP or HTTPS video URL."],
  ])("rejects an invalid JSON URL without leaking parser details", async (body, message) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_INPUT",
        message,
        retryable: false,
      },
    });
  });

  it.each(["../private/demo.mp4", "C:\\Users\\demo\\video.mp4"])(
    "rejects an upload filename containing a path: %s",
    async (fileName) => {
      const boundary = "capcheck-test-boundary";
      const multipartBody = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
        "Content-Type: video/mp4",
        "",
        "video",
        `--${boundary}--`,
        "",
      ].join("\r\n");

      const response = await POST(
        new Request("http://127.0.0.1:3000/api/analyze", {
          method: "POST",
          headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: {
          code: "INVALID_INPUT",
          message: "Choose a video file without a path in its name.",
          retryable: false,
        },
      });
    },
  );

  it("rejects an oversized multipart request before parsing its body", async () => {
    const response = await POST(
      new Request("http://127.0.0.1:3000/api/analyze", {
        method: "POST",
        headers: {
          "content-length": String(50 * 1024 * 1024 + 1),
          "content-type": "multipart/form-data; boundary=unused",
        },
        body: "not parsed",
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Video uploads must be 50 MB or smaller.",
        retryable: false,
      },
    });
  });

  it("rejects an oversized file after multipart parsing when length is absent", async () => {
    const form = {
      get(key: string) {
        if (key === "file") {
          return { name: "large.mp4", size: 50 * 1024 * 1024 + 1 };
        }
        return null;
      },
    } as FormData;
    const requestBoundary = {
      headers: new Headers({
        "content-type": "multipart/form-data; boundary=chunked",
      }),
      formData: async () => form,
      signal: new AbortController().signal,
    } as Request;

    const response = await POST(requestBoundary);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE", retryable: false },
    });
  });

  it.each([
    {
      label: "HTTPS URL",
      buildRequest: () => request({
        url: "https://www.youtube.com/shorts/demo",
        scenario: "scammy",
      }),
      expectedScorecard: DEMO_SCORECARDS.scammy,
    },
    {
      label: "small upload",
      buildRequest: () => {
        const form = new FormData();
        form.set(
          "file",
          new File(["video"], "demo.mp4", { type: "video/mp4" }),
        );
        form.set("scenario", "partialFailure");
        return new Request("http://127.0.0.1:3000/api/analyze", {
          method: "POST",
          body: form,
        });
      },
      expectedScorecard: DEMO_SCORECARDS.partialFailure,
    },
  ])("streams complete contract-valid SSE for a valid $label", async ({
    buildRequest,
    expectedScorecard,
  }) => {
    const response = await POST(buildRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");

    const events: AnalysisEvent[] = [];
    for await (const event of parseAnalysisStream(response)) {
      events.push(AnalysisEventSchema.parse(event));
    }

    expect(events.at(-1)).toEqual({
      type: "complete",
      scorecard: expectedScorecard,
    });
  });

  it.each([
    ["mixed", { type: "complete", scorecard: DEMO_SCORECARDS.mixed }],
    ["scammy", { type: "complete", scorecard: DEMO_SCORECARDS.scammy }],
    [
      "legitimate",
      { type: "complete", scorecard: DEMO_SCORECARDS.legitimate },
    ],
    [
      "partialFailure",
      { type: "complete", scorecard: DEMO_SCORECARDS.partialFailure },
    ],
    ["fatal", DEMO_FATAL_ERROR],
  ] as const)(
    "streams the expected terminal event for the %s scenario",
    async (scenario, expectedTerminal) => {
      const response = await POST(
        request({ url: "https://www.youtube.com/shorts/demo", scenario }),
      );
      const events: AnalysisEvent[] = [];

      for await (const event of parseAnalysisStream(response)) events.push(event);

      expect(events.at(-1)).toEqual(expectedTerminal);
      expect(events.slice(0, -1).map((event) => event.type)).toEqual([
        "progress",
        "progress",
        "progress",
        "progress",
        "progress",
      ]);
    },
  );

  it("rejects an unknown fixture scenario", async () => {
    const response = await POST(
      request({
        url: "https://www.youtube.com/shorts/demo",
        scenario: "private-debug-mode",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_INPUT",
        message: "Choose a valid analysis scenario.",
        retryable: false,
      },
    });
  });

  it("refuses to run fixture analysis in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(
      request({ url: "https://www.youtube.com/shorts/demo" }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "ANALYSIS_UNAVAILABLE",
        message: "Analysis is unavailable right now. Please try again later.",
        retryable: false,
      },
    });
    expect(JSON.stringify(body)).not.toContain("fixture");
    expect(JSON.stringify(body)).not.toContain(process.cwd());
  });

  it("streams the live adapter outside fixture mode with the parsed URL source", async () => {
    delete process.env.CAPCHECK_ANALYSIS_MODE;
    const liveStream = vi.fn(async function* () {
      yield { type: "complete", scorecard: DEMO_SCORECARDS.mixed } as const;
    });
    const livePost = createAnalyzeHandler({
      createLiveStream: () => liveStream,
    });

    const response = await livePost(
      request({ url: "https://www.youtube.com/shorts/demo" }),
    );
    const events: AnalysisEvent[] = [];
    for await (const event of parseAnalysisStream(response)) events.push(event);

    expect(liveStream).toHaveBeenCalledWith(
      { kind: "url", url: "https://www.youtube.com/shorts/demo" },
      expect.any(AbortSignal),
    );
    expect(events.at(-1)).toEqual({
      type: "complete",
      scorecard: DEMO_SCORECARDS.mixed,
    });
  });

  it("passes live multipart bytes and MIME type without exposing them in the scorecard source", async () => {
    delete process.env.CAPCHECK_ANALYSIS_MODE;
    const liveStream = vi.fn(async function* () {
      yield { type: "complete", scorecard: DEMO_SCORECARDS.mixed } as const;
    });
    const livePost = createAnalyzeHandler({
      createLiveStream: () => liveStream,
    });
    const form = {
      get(key: string) {
        if (key === "file") {
          return {
            name: "prepared.mp4",
            type: "video/mp4",
            size: 3,
            arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          };
        }
        return null;
      },
    } as FormData;
    const uploadRequest = {
      headers: new Headers({
        "content-type": "multipart/form-data; boundary=live-test",
      }),
      formData: async () => form,
      signal: new AbortController().signal,
    } as Request;

    const response = await livePost(uploadRequest);
    await response.text();

    expect(liveStream).toHaveBeenCalledWith(
      {
        kind: "upload",
        fileName: "prepared.mp4",
        mimeType: "video/mp4",
        bytes: new Uint8Array([1, 2, 3]),
      },
      expect.any(AbortSignal),
    );
  });

  it("returns a sanitized unavailable response when live credentials are missing", async () => {
    delete process.env.CAPCHECK_ANALYSIS_MODE;
    delete process.env.GEMINI_API_KEY;
    delete process.env.FINNHUB_KEY;

    const response = await POST(
      request({ url: "https://www.youtube.com/shorts/demo" }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "ANALYSIS_UNAVAILABLE",
        message: "Analysis is unavailable right now. Please try again later.",
        retryable: false,
      },
    });
    expect(JSON.stringify(body)).not.toContain("GEMINI_API_KEY");
    expect(JSON.stringify(body)).not.toContain("FINNHUB_KEY");
  });

  it("emits no frames when the request signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortedRequest = new Request(
      "http://127.0.0.1:3000/api/analyze",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: "https://www.youtube.com/shorts/demo",
          scenario: "mixed",
        }),
        signal: controller.signal,
      },
    );

    const response = await POST(abortedRequest);

    expect(await response.text()).toBe("");
  });

  it("cancels the response body without a rejected stream start or later frames", async () => {
    const response = await POST(
      request({
        url: "https://www.youtube.com/shorts/demo",
        scenario: "mixed",
      }),
    );
    const reader = response.body!.getReader();
    const unhandled: unknown[] = [];
    const recordUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", recordUnhandled);

    try {
      await expect(reader.cancel()).resolves.toBeUndefined();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
      await expect(reader.read()).resolves.toEqual({
        done: true,
        value: undefined,
      });
    } finally {
      process.off("unhandledRejection", recordUnhandled);
    }
  });
});
