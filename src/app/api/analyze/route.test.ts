import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalysisEventSchema, type AnalysisEvent } from "@/domain/analysis";
import { DEMO_SCORECARDS } from "@/fixtures/scorecards";
import { parseAnalysisStream } from "@/lib/analysis-stream";

import { POST } from "./route";

const ORIGINAL_MODE = process.env.CAPCHECK_ANALYSIS_MODE;

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
  });

  it.each([
    [{}, "A video URL is required."],
    [{ url: "" }, "A video URL is required."],
    [{ url: "javascript:alert(1)" }, "Enter a valid HTTP or HTTPS video URL."],
  ])("rejects an invalid JSON URL without leaking parser details", async (body, message) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
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

    const events: AnalysisEvent[] = [];
    for await (const event of parseAnalysisStream(response)) {
      events.push(AnalysisEventSchema.parse(event));
    }

    expect(events.at(-1)).toEqual({
      type: "complete",
      scorecard: expectedScorecard,
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
});
