"use client";

import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { AnalysisStage, ErrorEvent, Scorecard } from "@/domain/analysis";
import { parseAnalysisStream } from "@/lib/analysis-stream";
import { IntakePanel } from "./intake-panel";
import { ProgressTimeline } from "./progress-timeline";
import { ScorecardView } from "./scorecard";

const allowedScenarios = new Set(["mixed", "scammy", "legitimate", "partialFailure", "fatal"]);
type Progress = { stage: AnalysisStage; message: string };

export function CapCheckApp() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<ErrorEvent["error"] | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(false);
  const scenario = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const value = new URLSearchParams(window.location.search).get("fixture");
    return value && allowedScenarios.has(value) ? value : undefined;
  }, []);

  const analyze = async () => {
    if (loading) return;
    setError(null); setScorecard(null); setProgress([]); setLoading(true);
    try {
      let body: BodyInit;
      let headers: HeadersInit | undefined;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        if (scenario) form.set("scenario", scenario);
        body = form;
      } else {
        body = JSON.stringify({ url, ...(scenario ? { scenario } : {}) });
        headers = { "content-type": "application/json" };
      }
      const response = await fetch("/api/analyze", { method: "POST", headers, body });
      for await (const event of parseAnalysisStream(response)) {
        if (event.type === "progress") setProgress((current) => [...current, { stage: event.stage, message: event.message }]);
        else if (event.type === "complete") setScorecard(event.scorecard);
        else setError(event.error);
      }
    } catch (cause) {
      setError({ code: "ANALYSIS_FAILED", message: cause instanceof Error ? cause.message : "CapCheck could not finish this analysis.", retryable: true });
    } finally { setLoading(false); }
  };
  const reset = () => { setUrl(""); setFile(null); setError(null); setProgress([]); setScorecard(null); setLoading(false); };

  return <main className="app-shell">
    <header className="app-header"><span className="brand-mark"><ShieldCheck aria-hidden="true" /></span><div><strong>CapCheck</strong><span>AI financial claim verifier</span></div></header>
    <section className="hero" aria-labelledby="page-title"><p className="eyebrow">Evidence before influence</p><h1 id="page-title">Is that money advice fact or cap?</h1><p>Paste a short-form video link or upload a clip. CapCheck finds the claims, checks the evidence, and shows what deserves your trust.</p></section>
    {!scorecard && <IntakePanel url={url} file={file} loading={loading} error={error} onUrlChange={setUrl} onFileChange={setFile} onSubmit={analyze} onRetry={analyze} onReset={reset} />}
    {(loading || progress.length > 0) && !scorecard && <ProgressTimeline progress={progress} />}
    {scorecard && <ScorecardView scorecard={scorecard} onReset={reset} onRetry={analyze} />}
  </main>;
}
