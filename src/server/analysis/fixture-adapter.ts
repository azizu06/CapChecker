import {
  AnalysisEventSchema,
  type AnalysisEvent,
  type AnalysisStage,
} from "@/domain/analysis";
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

const waitForNextStage = (signal: AbortSignal, delayMs = 100) =>
  new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const finish = (ready: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(ready);
    };
    const abort = () => finish(false);
    const timer = setTimeout(() => finish(true), delayMs);
    signal.addEventListener("abort", abort, { once: true });
  });

const buildCompletionEvent = (scenario: keyof typeof DEMO_SCORECARDS) =>
  AnalysisEventSchema.parse({
    type: "complete",
    scorecard: DEMO_SCORECARDS[scenario],
  });

export async function* streamFixtureAnalysis(
  input: FixtureAnalysisInput,
  signal: AbortSignal,
): AsyncGenerator<AnalysisEvent> {
  for (const event of progress) {
    if (signal.aborted) return;
    yield { type: "progress", ...event };
    if (!(await waitForNextStage(signal))) return;
  }

  if (signal.aborted) return;

  const scenario = input.scenario ?? "mixed";
  if (scenario === "fatal") {
    yield DEMO_FATAL_ERROR;
    return;
  }

  yield buildCompletionEvent(scenario);
}
