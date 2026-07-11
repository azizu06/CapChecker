import { Check, Circle, Loader2 } from "lucide-react";

import type { AnalysisStage } from "@/domain/analysis";

export type UiStage = AnalysisStage | "complete";
export type UiProgress = { stage: UiStage; message: string };

const stages: { key: UiStage; label: string }[] = [
  { key: "fetching", label: "Fetching" },
  { key: "processing", label: "Processing" },
  { key: "extracting", label: "Extracting" },
  { key: "verifying", label: "Verifying" },
  { key: "synthesizing", label: "Synthesizing" },
  { key: "complete", label: "Complete" },
];

export function ProgressTimeline({ progress }: { progress: UiProgress[] }) {
  const active = progress.at(-1);
  const currentIndex = Math.max(
    0,
    stages.findIndex(({ key }) => key === active?.stage),
  );
  const isComplete = active?.stage === "complete";

  return (
    <section
      className="progress-panel panel"
      aria-labelledby="progress-title"
      aria-live="polite"
    >
      <p className="kicker">Research process</p>
      <h2 id="progress-title">
        {isComplete ? "Analysis complete" : "Checking the claims"}
      </h2>
      <ol>
        {stages.map((stage, index) => {
          const complete =
            index < currentIndex || (isComplete && index === currentIndex);
          const current = index === currentIndex && !isComplete;
          return (
            <li
              key={stage.key}
              className={complete ? "complete" : current ? "current" : "future"}
            >
              <span className="step-dot">
                {complete ? (
                  <Check aria-hidden="true" />
                ) : current ? (
                  <Loader2 aria-hidden="true" />
                ) : (
                  <Circle aria-hidden="true" />
                )}
              </span>
              <span>
                <strong>{stage.label}</strong>
                <small>
                  {index === currentIndex
                    ? active?.message ?? "Starting analysis"
                    : complete
                      ? "Complete"
                      : "Waiting"}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
