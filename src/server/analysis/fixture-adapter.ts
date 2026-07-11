import type { AnalysisEvent, AnalysisStage } from "@/domain/analysis";
import { DEMO_FATAL_ERROR, DEMO_SCORECARDS } from "@/fixtures/scorecards";

export type FixtureScenario = keyof typeof DEMO_SCORECARDS | "fatal";

export type FixtureAnalysisInput = {
  scenario?: FixtureScenario;
};

const progress: ReadonlyArray<{
  stage: AnalysisStage;
  message: string;
}> = [
  { stage: "fetching", message: "Loading the source video" },
  { stage: "processing", message: "Preparing the video for analysis" },
  { stage: "extracting", message: "Extracting financial claims" },
  { stage: "verifying", message: "Checking claims against evidence" },
  { stage: "synthesizing", message: "Building the CapCheck scorecard" },
];

export async function* streamFixtureAnalysis(
  input: FixtureAnalysisInput,
  signal: AbortSignal,
): AsyncGenerator<AnalysisEvent> {
  for (const event of progress) {
    if (signal.aborted) return;
    yield { type: "progress", ...event };
  }

  if (signal.aborted) return;

  const scenario = input.scenario ?? "mixed";
  if (scenario === "fatal") {
    yield DEMO_FATAL_ERROR;
    return;
  }

  yield { type: "complete", scorecard: DEMO_SCORECARDS[scenario] };
}
