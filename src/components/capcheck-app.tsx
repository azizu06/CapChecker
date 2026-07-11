"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { AnalysisStage, ErrorEvent, Scorecard } from "@/domain/analysis";
import { parseAnalysisStream } from "@/lib/analysis-stream";

import { IntakePanel, validateSubmission } from "./intake-panel";
import { ProgressTimeline, type UiProgress } from "./progress-timeline";
import { ScorecardView } from "./scorecard";

const allowedScenarios = new Set([
  "mixed",
  "scammy",
  "legitimate",
  "partialFailure",
  "fatal",
]);

export function CapCheckApp() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [nextUrl, setNextUrl] = useState("");
  const [miniError, setMiniError] = useState("");
  const [error, setError] = useState<ErrorEvent["error"] | null>(null);
  const [validation, setValidation] = useState("");
  const [progress, setProgress] = useState<UiProgress[]>([]);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(false);

  const scenario = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const value = new URLSearchParams(window.location.search).get("fixture");
    return value && allowedScenarios.has(value) ? value : undefined;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.capcheckHydrated = "true";
    return () => {
      delete document.documentElement.dataset.capcheckHydrated;
    };
  }, []);

  const performAnalysis = async (submitUrl: string, submitFile: File | null) => {
    setValidation("");
    setMiniError("");
    setError(null);
    setScorecard(null);
    setProgress([]);
    setLoading(true);

    try {
      let body: BodyInit;
      let headers: HeadersInit | undefined;
      if (submitFile) {
        const form = new FormData();
        form.set("file", submitFile);
        if (scenario) form.set("scenario", scenario);
        body = form;
      } else {
        body = JSON.stringify({ url: submitUrl, ...(scenario ? { scenario } : {}) });
        headers = { "content-type": "application/json" };
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body,
      });
      for await (const event of parseAnalysisStream(response)) {
        if (event.type === "progress") {
          setProgress((current) => [
            ...current,
            { stage: event.stage as AnalysisStage, message: event.message },
          ]);
        } else if (event.type === "complete") {
          setProgress((current) => [
            ...current,
            { stage: "complete", message: "Analysis complete" },
          ]);
          setScorecard(event.scorecard);
        } else {
          setProgress([]);
          setError(event.error);
        }
      }
    } catch (cause) {
      setProgress([]);
      setError({
        code: "ANALYSIS_FAILED",
        message:
          cause instanceof Error
            ? cause.message
            : "CapCheck could not finish this analysis.",
        retryable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const analyze = () => {
    if (loading) return;
    const validationMessage = validateSubmission(url, file);
    if (validationMessage) {
      setError(null);
      setValidation(validationMessage);
      return;
    }
    void performAnalysis(url, file);
  };

  const analyzeNext = (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const validationMessage = validateSubmission(nextUrl, null);
    if (validationMessage) {
      setMiniError(validationMessage);
      return;
    }
    const submitUrl = nextUrl;
    setUrl(submitUrl);
    setFile(null);
    setNextUrl("");
    void performAnalysis(submitUrl, null);
  };

  const reset = () => {
    setUrl("");
    setFile(null);
    setNextUrl("");
    setMiniError("");
    setError(null);
    setValidation("");
    setProgress([]);
    setScorecard(null);
    setLoading(false);
  };

  const changeUrl = (value: string) => {
    setUrl(value);
    setValidation("");
  };

  const changeFile = (value: File | null) => {
    setFile(value);
    setValidation("");
    if (value) setError(null);
  };

  if (scorecard) {
    return (
      <main className="app app--results">
        <header className="results-header">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck />
          </span>
          <strong>CapCheck</strong>
          <span className="tagline">Financial advice, fact-checked</span>
          <form className="mini-intake" onSubmit={analyzeNext} noValidate>
            <input
              type="url"
              value={nextUrl}
              aria-label="Check another video URL"
              aria-invalid={Boolean(miniError)}
              placeholder="Check another video — paste a URL…"
              onChange={(event) => {
                setNextUrl(event.target.value);
                setMiniError("");
              }}
            />
            <button type="submit">Check it</button>
          </form>
        </header>
        {miniError && (
          <p className="mini-error" role="alert">
            {miniError}
          </p>
        )}
        <div className="result-actions" aria-label="Completed result actions">
          <button className="ghost" type="button" onClick={reset}>
            Check another
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => void performAnalysis(url, file)}
          >
            Run again
          </button>
        </div>
        <ScorecardView scorecard={scorecard} />
      </main>
    );
  }

  return (
    <main className="app app--landing">
      <header className="app-header">
        <span className="brand-mark" aria-hidden="true">
          <ShieldCheck />
        </span>
        <strong>CapCheck</strong>
        <span className="tagline">Financial advice, fact-checked</span>
      </header>
      <section className="hero" aria-labelledby="page-title">
        <h1 id="page-title">
          Is that stock tip <em>cap</em>? Check before you act.
        </h1>
        <p>
          Paste a finance video. CapCheck pulls out the claims, verifies each one
          against available evidence, and shows you exactly what holds up.
        </p>
      </section>
      <IntakePanel
        url={url}
        file={file}
        loading={loading}
        error={error}
        validation={validation}
        onUrlChange={changeUrl}
        onFileChange={changeFile}
        onSubmit={analyze}
        onRetry={analyze}
        onReset={reset}
      />
      {(loading || progress.length > 0) && (
        <ProgressTimeline progress={progress} />
      )}
    </main>
  );
}
