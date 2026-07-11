import { ExternalLink, Flag, RotateCcw, ShieldAlert } from "lucide-react";

import type { Scorecard } from "@/domain/analysis";
import { formatTimestamp } from "@/lib/format-timestamp";

import { ClaimCard } from "./claim-card";

const labels = {
  "no-cap": "No cap",
  "some-cap": "Some cap",
  "full-of-cap": "Full of cap",
} as const;

const explanations = {
  "no-cap": "Most checkable claims are supported by credible evidence.",
  "some-cap": "Some claims are misleading, unsupported, or need more context.",
  "full-of-cap": "A high share of claims are misleading or unsupported.",
} as const;

const trustRank = { primary: 4, high: 3, medium: 2, low: 1 };

export function ScorecardView({
  scorecard,
  onReset,
  onRetry,
}: {
  scorecard: Scorecard;
  onReset(): void;
  onRetry(): void;
}) {
  const strongest = scorecard.verifications
    .flatMap((item) =>
      item.evidence.map((evidence) => ({ evidence, verdict: item.verdict })),
    )
    .sort(
      (a, b) =>
        trustRank[b.evidence.trustTier] - trustRank[a.evidence.trustTier],
    )[0];
  const evidenceById = new Map(
    scorecard.verifications.flatMap((verification) =>
      verification.evidence.map((evidence) => [evidence.id, evidence] as const),
    ),
  );

  return (
    <section className="results" aria-labelledby="result-title">
      <div className={`score-header panel ${scorecard.capLabel}`}>
        <div className="score-block">
          <p className="step-label">Cap Score · higher is worse</p>
          <div className="score-number">{scorecard.capScore}</div>
          <h2 id="result-title">{labels[scorecard.capLabel]}</h2>
          <p>{explanations[scorecard.capLabel]}</p>
          <div className="score-band" aria-label="Cap Score bands">
            <span>No cap 0–29</span>
            <span>Some cap 30–69</span>
            <span>Full of cap 70–100</span>
          </div>
        </div>
        <div className="result-takeaway">
          <p className="step-label">What we found</p>
          <h3>{scorecard.summary}</h3>
          {strongest && (
            <div className="strongest-source">
              <ShieldAlert aria-hidden="true" />
              <span>
                <small>Strongest source</small>
                <strong>{strongest.evidence.publisher}</strong>
                <a
                  href={strongest.evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open strongest source: ${strongest.evidence.title} (opens in new tab)`}
                >
                  {strongest.evidence.title}
                  <ExternalLink aria-hidden="true" />
                </a>
              </span>
            </div>
          )}
          <div className="result-actions">
            <button type="button" onClick={onReset}>
              <RotateCcw aria-hidden="true" />
              Check another
            </button>
            <button type="button" onClick={onRetry}>
              Run again
            </button>
          </div>
        </div>
      </div>

      <section className="result-section" aria-labelledby="claims-title">
        <div className="section-heading">
          <div>
            <p className="step-label">Evidence review</p>
            <h2 id="claims-title">Claims reviewed</h2>
          </div>
          <span>
            {scorecard.verifications.length} fact-checked
            {scorecard.skippedClaims?.length
              ? ` · ${scorecard.skippedClaims.length} skipped`
              : ""}
          </span>
        </div>
        <div className="claim-list">
          {scorecard.verifications.map((verification) => (
            <ClaimCard
              key={verification.claim.id}
              verification={verification}
            />
          ))}
          {scorecard.skippedClaims?.map((claim) => (
            <ClaimCard key={claim.id} skippedClaim={claim} />
          ))}
        </div>
      </section>

      <div className="result-grid">
        <section
          className="result-section panel"
          aria-labelledby="hype-title"
        >
          <p className="step-label">Pressure check</p>
          <h2 id="hype-title">Hype language</h2>
          {scorecard.hypeFindings.length ? (
            <ul className="hype-list">
              {scorecard.hypeFindings.map((finding) => (
                <li key={finding.id}>
                  <Flag aria-hidden="true" />
                  <div>
                    <strong>“{finding.phrase}”</strong>
                    <small>
                      {finding.category} · {finding.severity}
                    </small>
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
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">No manipulative hype language detected.</p>
          )}
        </section>

        <section
          className="result-section panel"
          aria-labelledby="actions-title"
        >
          <p className="step-label">Before you act</p>
          <h2 id="actions-title">Next steps</h2>
          <ol className="next-actions">
            {scorecard.nextActions.map((action, index) => {
              const evidence = action.evidenceId
                ? evidenceById.get(action.evidenceId)
                : undefined;

              return (
                <li key={action.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{action.label}</strong>
                    <p>{action.description}</p>
                    {evidence ? (
                      <div className="action-source">
                        <small>Evidence source · {evidence.publisher}</small>
                        <a
                          href={evidence.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open evidence source: ${evidence.title} (opens in new tab)`}
                        >
                          {evidence.title}
                          <ExternalLink aria-hidden="true" />
                        </a>
                      </div>
                    ) : (
                      action.url && (
                        <a
                          href={action.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${action.label} (opens in new tab)`}
                        >
                          Open resource <ExternalLink aria-hidden="true" />
                        </a>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </section>
  );
}
