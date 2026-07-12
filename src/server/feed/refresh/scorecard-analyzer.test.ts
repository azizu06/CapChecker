import { describe, expect, it } from "vitest";

import type { AnalysisEvent } from "@/domain/analysis";
import { DEMO_SCORECARDS } from "@/fixtures/scorecards";

import { createScorecardAnalyzer, type AnalysisStream } from "./scorecard-analyzer";

const streamOf = (events: AnalysisEvent[]): AnalysisStream =>
  async function* stream() {
    for (const event of events) yield event;
  };

describe("createScorecardAnalyzer", () => {
  it("returns the scorecard from a completing stream", async () => {
    const analyze = createScorecardAnalyzer({
      createStream: () =>
        streamOf([
          { type: "progress", stage: "fetching", message: "Loading" },
          { type: "complete", scorecard: DEMO_SCORECARDS.legitimate },
        ]),
    });

    await expect(
      analyze({
        url: "https://www.youtube.com/watch?v=x",
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual(DEMO_SCORECARDS.legitimate);
  });

  it("throws a sanitized retryable error when the stream errors", async () => {
    const analyze = createScorecardAnalyzer({
      createStream: () =>
        streamOf([
          {
            type: "error",
            error: { code: "ANALYSIS_FAILED", message: "boom", retryable: true },
          },
        ]),
    });

    await expect(
      analyze({
        url: "https://www.youtube.com/watch?v=x",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ name: "RefreshError", retryable: true });
  });

  it("throws when the stream ends without completing", async () => {
    const analyze = createScorecardAnalyzer({
      createStream: () => streamOf([]),
    });

    await expect(
      analyze({
        url: "https://www.youtube.com/watch?v=x",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ name: "RefreshError" });
  });

  it("turns an analysis deadline into a sanitized retryable failure", async () => {
    const analyze = createScorecardAnalyzer({
      timeoutMs: 5,
      createStream: () =>
        async function* stream(_source, signal) {
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            });
          });
        },
    });

    await expect(
      analyze({
        url: "https://www.youtube.com/watch?v=x",
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: "ANALYSIS_FAILED", retryable: true });
  });

  it("preserves caller abort reason and closes the analyzer stream", async () => {
    let cleanedUp = false;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const analyze = createScorecardAnalyzer({
      createStream: () =>
        async function* stream(_source, signal) {
          try {
            yield { type: "progress", stage: "fetching", message: "Loading" };
            await new Promise<void>((_resolve, reject) => {
              markStarted();
              signal.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              });
            });
          } finally {
            cleanedUp = true;
          }
        },
    });
    const controller = new AbortController();
    const reason = new DOMException("user left", "AbortError");
    const result = analyze({
      url: "https://www.youtube.com/watch?v=x",
      signal: controller.signal,
    });

    await started;
    controller.abort(reason);

    await expect(result).rejects.toBe(reason);
    expect(cleanedUp).toBe(true);
  });
});
