import {
  ExternalLink,
  FileText,
  Search,
  ShieldCheck,
  Video,
} from "lucide-react";

import type { Scorecard } from "@/domain/analysis";
import { formatTimestamp } from "@/lib/format-timestamp";

import { ClaimCard } from "./claim-card";
import { CountUp } from "./react-bits/count-up";
import { ResultsTabs, type ResultsTab } from "./results-tabs";
import { ScoreMeter } from "./score-meter";

const labels = {
  "no-cap": "No cap",
  "some-cap": "Some cap",
  "full-of-cap": "Full of cap",
} as const;

const toneClass = {
  "no-cap": "good-c",
  "some-cap": "warn-c",
  "full-of-cap": "bad-c",
} as const;

const trustRank = { primary: 4, high: 3, medium: 2, low: 1 };

const displayUrl = (url: string) => url.replace(/^https?:\/\//, "");

export function ScorecardView({ scorecard }: { scorecard: Scorecard }) {
  const strongest = scorecard.verifications
    .flatMap((item) => item.evidence)
    .sort((a, b) => trustRank[b.trustTier] - trustRank[a.trustTier])[0];

  const evidenceById = new Map(
    scorecard.verifications.flatMap((verification) =>
      verification.evidence.map((evidence) => [evidence.id, evidence] as const),
    ),
  );

  const tone = toneClass[scorecard.capLabel];
  const sourceTitle =
    scorecard.source.title ??
    (scorecard.source.kind === "upload" ? scorecard.source.fileName : "this video");

  const claimsPanel = (
    <div className="claims">
      {scorecard.verifications.map((verification) => (
        <ClaimCard key={verification.claim.id} verification={verification} />
      ))}
      {scorecard.skippedClaims?.map((claim) => (
        <ClaimCard key={claim.id} skippedClaim={claim} />
      ))}
    </div>
  );

  const hypePanel = (
    <div className="panel list-panel">
      {scorecard.hypeFindings.length ? (
        <ul className="hype">
          {scorecard.hypeFindings.map((finding) => (
            <li key={finding.id}>
              <b>“{finding.phrase}”</b>
              <span className="cat">
                {finding.category} · {finding.severity}
              </span>
              {finding.context && (
                <blockquote>
                  {finding.timestampSeconds !== undefined && (
                    <time dateTime={`PT${finding.timestampSeconds}S`}>
                      {formatTimestamp(finding.timestampSeconds)}
                    </time>
                  )}
                  {finding.context}
                </blockquote>
              )}
              <p>{finding.explanation}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-note">No manipulative hype language detected.</p>
      )}
    </div>
  );

  const stepsPanel = (
    <div className="panel list-panel">
      <ol className="steps">
        {scorecard.nextActions.map((action, index) => {
          const evidence = action.evidenceId
            ? evidenceById.get(action.evidenceId)
            : undefined;
          return (
            <li key={action.id}>
              <span className="num" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <b>{action.label}</b>
                <p>{action.description}</p>
                {evidence ? (
                  <a
                    href={evidence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open evidence source: ${evidence.title} (opens in new tab)`}
                  >
                    {evidence.title}
                    <ExternalLink aria-hidden="true" />
                  </a>
                ) : (
                  action.url && (
                    <a
                      href={action.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${action.label} (opens in new tab)`}
                    >
                      Open resource
                      <ExternalLink aria-hidden="true" />
                    </a>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );

  const tabs: ResultsTab[] = [
    {
      key: "claims",
      label: "Claims reviewed",
      count: scorecard.verifications.length,
      panel: claimsPanel,
    },
    {
      key: "hype",
      label: "Hype language",
      count: scorecard.hypeFindings.length,
      panel: hypePanel,
    },
    {
      key: "steps",
      label: "Before you act",
      count: scorecard.nextActions.length,
      panel: stepsPanel,
    },
  ];

  return (
    <div className="main">
      <p className="source-line">
        <Video aria-hidden="true" />
        Checked: <b>{sourceTitle}</b>
        {scorecard.source.kind === "url" ? (
          <a
            href={scorecard.source.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the checked video (opens in new tab)"
          >
            {displayUrl(scorecard.source.url)}
            <ExternalLink aria-hidden="true" />
          </a>
        ) : (
          <span className="file-name">{scorecard.source.fileName}</span>
        )}
        <span className="when">· just now</span>
      </p>

      <section
        className="panel score-header"
        aria-labelledby="result-title"
        aria-roledescription="Cap Score"
      >
        <div className="score-left">
          <div
            className={`score-num ${tone}`}
            aria-label={`Cap Score ${scorecard.capScore} out of 100`}
          >
            <CountUp to={scorecard.capScore} />
          </div>
          <h2 id="result-title" className={tone}>
            {labels[scorecard.capLabel]}
          </h2>
          <ScoreMeter score={scorecard.capScore} />
        </div>
        <div className="score-right">
          <p className="summary">{scorecard.summary}</p>
          {strongest && (
            <span className="strongest">
              <ShieldCheck aria-hidden="true" />
              Strongest source:{" "}
              <a
                href={strongest.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open strongest source: ${strongest.title} (opens in new tab)`}
              >
                {strongest.publisher} — {strongest.title}
                <ExternalLink aria-hidden="true" />
              </a>
            </span>
          )}
        </div>
      </section>

      <ResultsTabs tabs={tabs} />

      <div className="how">
        <h2>How the Cap Score works</h2>
        <div className="how-grid">
          <div>
            <FileText aria-hidden="true" />
            <b>Claims get extracted</b>
            <p>
              CapCheck transcribes the video and pulls out every checkable
              statement — facts and predictions, with timestamps.
            </p>
          </div>
          <div>
            <Search aria-hidden="true" />
            <b>Evidence gets checked</b>
            <p>
              Each claim is verified against primary sources — regulators,
              official filings, and index publishers first.
            </p>
          </div>
          <div>
            <ShieldCheck aria-hidden="true" />
            <b>The score adds up</b>
            <p>
              False and unsupported claims raise the Cap Score; hype language
              raises it further. 0 is clean, 100 is full of cap.
            </p>
          </div>
        </div>
        <div className="app-footer">
          <a href="#methodology">Methodology</a>
          <a href="#sources">Sources we trust</a>
          <a href="#report">Report a bad verdict</a>
          <span className="disclaimer">
            CapCheck verifies claims — it isn&rsquo;t financial advice.
          </span>
        </div>
      </div>
    </div>
  );
}
