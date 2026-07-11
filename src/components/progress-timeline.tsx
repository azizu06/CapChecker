import { Check, Circle } from "lucide-react";
import type { AnalysisStage } from "@/domain/analysis";

const stages: { key: AnalysisStage | "complete"; label: string }[] = [
  { key: "fetching", label: "Fetching" }, { key: "processing", label: "Processing" },
  { key: "extracting", label: "Extracting" }, { key: "verifying", label: "Verifying" },
  { key: "synthesizing", label: "Synthesizing" }, { key: "complete", label: "Complete" },
];
export function ProgressTimeline({ progress }: { progress: { stage: AnalysisStage; message: string }[] }) {
  const currentIndex = Math.max(0, stages.findIndex(({ key }) => key === progress.at(-1)?.stage));
  return <section className="progress-panel panel" aria-labelledby="progress-title" aria-live="polite"><p className="step-label">Research process</p><h2 id="progress-title">Checking the claims</h2><ol>{stages.map((stage, index) => { const complete = index < currentIndex; const current = index === currentIndex; return <li key={stage.key} className={complete ? "complete" : current ? "current" : "future"}>{complete ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}<span><strong>{stage.label}</strong><small>{current ? progress.at(-1)?.message ?? "Starting analysis" : complete ? "Complete" : "Waiting"}</small></span></li>; })}</ol></section>;
}
