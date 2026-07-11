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
});
