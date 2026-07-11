import { describe, expect, it } from "vitest";

import { AnalysisEventSchema } from "@/domain/analysis";
import { DEMO_SCORECARDS } from "@/fixtures/scorecards";

import { streamFixtureAnalysis } from "./fixture-adapter";

describe("streamFixtureAnalysis", () => {
  it("emits ordered progress stages followed by one valid mixed completion", async () => {
    const events = [];

    for await (const event of streamFixtureAnalysis(
      { scenario: "mixed" },
      new AbortController().signal,
    )) {
      events.push(AnalysisEventSchema.parse(event));
    }

    expect(
      events.map((event) =>
        event.type === "progress" ? event.stage : event.type,
      ),
    ).toEqual([
      "fetching",
      "processing",
      "extracting",
      "verifying",
      "synthesizing",
      "complete",
    ]);
    expect(events.at(-1)).toEqual({
      type: "complete",
      scorecard: DEMO_SCORECARDS.mixed,
    });
  });

  it("stops before later stages after its signal is aborted", async () => {
    const controller = new AbortController();
    const stream = streamFixtureAnalysis(
      { scenario: "mixed" },
      controller.signal,
    );

    expect(await stream.next()).toMatchObject({
      done: false,
      value: { type: "progress", stage: "fetching" },
    });
    controller.abort();

    expect(await stream.next()).toEqual({ done: true, value: undefined });
  });

  it("paces progress asynchronously so the UI can render it", async () => {
    const stream = streamFixtureAnalysis(
      { scenario: "mixed" },
      new AbortController().signal,
    );
    await stream.next();

    const next = stream.next();
    const immediate = await Promise.race([
      next.then(() => "event"),
      new Promise<string>((resolve) => setTimeout(() => resolve("pending"), 10)),
    ]);

    expect(immediate).toBe("pending");
    expect(await next).toMatchObject({
      done: false,
      value: { type: "progress", stage: "processing" },
    });
  });
});
