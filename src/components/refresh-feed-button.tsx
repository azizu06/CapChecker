"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { parseRefreshStream } from "@/lib/refresh-stream";
import type { AcceptedSummary } from "@/server/feed/refresh/events";
import type { RefreshCounts } from "@/server/feed/refresh/ports";

type RefreshResult = {
  counts: RefreshCounts;
  accepted: AcceptedSummary | null;
};

type Props = {
  /** Called after a successful refresh so the feed can reload. */
  onRefreshed?: (result: RefreshResult) => void;
  endpoint?: string;
  readOnly?: boolean;
};

const summarize = (counts: RefreshCounts) =>
  `${counts.discovered} found · ${counts.analyzed} analyzed · ${counts.kept} kept · ${counts.rejected} rejected · ${counts.duplicate} duplicate`;

/**
 * Minimal client control for the Verified Feed. Disabled while a refresh is in
 * flight, shows live stage text, and settles on a final counts summary (or a
 * safe error). Lane B drops this into the feed page; the orchestrator supplies
 * `onRefreshed` to reload the catalog. Uses shared cream tokens via existing
 * `primary` / `helper` / `field-error` classes.
 */
export function RefreshFeedButton({
  onRefreshed,
  endpoint = "/api/feed/refresh",
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [stageText, setStageText] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (readOnly || inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    setStageText("Starting refresh…");
    setSummary("");
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { accept: "text/event-stream" },
      });

      let result: RefreshResult | null = null;
      for await (const event of parseRefreshStream(response)) {
        if (event.type === "stage") {
          setStageText(event.message);
        } else if (event.type === "complete") {
          result = { counts: event.counts, accepted: event.accepted };
          setStageText(
            event.accepted ? "Added a newly vetted video." : "No new video cleared the gate.",
          );
          setSummary(summarize(event.counts));
        } else {
          setError(event.error.message);
        }
      }

      if (result) {
        onRefreshed?.(result);
        router.refresh();
      }
    } catch {
      setError("CapCheck could not finish the feed refresh. Please try again.");
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  }, [endpoint, onRefreshed, readOnly, router]);

  return (
    <div className="refresh-feed">
      <button
        type="button"
        className="primary"
        onClick={refresh}
        disabled={readOnly || running}
        aria-busy={running}
      >
        <RefreshCw aria-hidden="true" />
        {running ? "Refreshing…" : "Refresh feed"}
      </button>
      {readOnly && (
        <p className="helper">Portfolio demo — live refresh is disabled.</p>
      )}
      {running && stageText && (
        <p className="helper" role="status" aria-live="polite">
          {stageText}
        </p>
      )}
      {!running && summary && (
        <p className="helper" role="status" aria-live="polite">
          {stageText} {summary}
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
