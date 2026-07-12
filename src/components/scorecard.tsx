import {
  ExternalLink,
  Play,
  ShieldCheck,
} from "lucide-react";

import type { Scorecard } from "@/domain/analysis";
import { formatTimestamp } from "@/lib/format-timestamp";

import { ClaimCard } from "./claim-card";
import { HowItWorks } from "./how-it-works";
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

export function ScorecardView({
  scorecard,
  onRunAgain,
  onCheckAnother,
}: {
  scorecard: Scorecard;
  onRunAgain(): void;
  onCheckAnother(): void;
}) {
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
      {scorecard.verifications.length === 0 &&
        (scorecard.skippedClaims?.length ?? 0) === 0 && (
          <p className="empty-note">No claims were reviewed.</p>
        )}
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
      {scorecard.nextActions.length ? (
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
      ) : (
        <p className="empty-note">No next actions were generated.</p>
      )}
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
      <div className="result-grid">
        <div className="result-content">
          <section
            className="score-section"
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
        </div>

        <aside className="source-rail" aria-label="Checked video">
          <div className="video-facade" aria-hidden="true">
            <Play />
          </div>
          <div className="source-details">
            <span>Checked: <b>{sourceTitle}</b></span>
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
          </div>
          <div className="result-actions" aria-label="Completed result actions">
            <button className="ghost" type="button" onClick={onRunAgain}>
              Run again
            </button>
            <button className="ghost" type="button" onClick={onCheckAnother}>
              Check another
            </button>
          </div>
        </aside>
      </div>
      <HowItWorks />
    </div>
  );
}
