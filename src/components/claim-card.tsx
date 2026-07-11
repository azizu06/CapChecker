import {
  ChevronDown,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import type { OpinionClaim, Verification } from "@/domain/analysis";
import { formatTimestamp } from "@/lib/format-timestamp";

const verdictLabels = {
  true: "Supported",
  "mostly-true": "Mostly supported",
  false: "Contradicted",
  unverifiable: "Unverifiable",
} as const;

const ClaimTimestamp = ({ timestampSeconds }: { timestampSeconds?: number }) =>
  timestampSeconds === undefined ? null : (
    <time dateTime={`PT${timestampSeconds}S`}>
      {formatTimestamp(timestampSeconds)}
    </time>
  );

type ClaimCardProps =
  | { verification: Verification; skippedClaim?: never }
  | { verification?: never; skippedClaim: OpinionClaim };

export function ClaimCard(props: ClaimCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (props.skippedClaim) {
    const claim = props.skippedClaim;
    return (
      <article className="claim-card opinion">
        <div className="claim-summary">
          <div className="claim-copy">
            <span className="status-pill">
              <MessageCircle aria-hidden="true" />
              Opinion — not fact-checked
            </span>
            <h3>{claim.text}</h3>
            <p className="claim-meta">
              <ClaimTimestamp timestampSeconds={claim.timestampSeconds} />
            </p>
          </div>
        </div>
      </article>
    );
  }

  const { verification } = props;
  const id = `claim-${verification.claim.id}`;
  const tone =
    verification.verdict === "false"
      ? "danger"
      : verification.verdict === "unverifiable"
        ? "info"
        : verification.verdict === "mostly-true"
          ? "warning"
          : "trust";

  return (
    <article className={`claim-card ${tone}`}>
      <div className="claim-summary">
        <div className="claim-copy">
          <span className="status-pill">
            {tone === "danger" ? (
              <TriangleAlert aria-hidden="true" />
            ) : (
              <ShieldCheck aria-hidden="true" />
            )}
            {verdictLabels[verification.verdict]}
          </span>
          <h3>{verification.claim.text}</h3>
          <p className="claim-meta">
            <ClaimTimestamp
              timestampSeconds={verification.claim.timestampSeconds}
            />
            <span>{Math.round(verification.confidence * 100)}% confidence</span>
          </p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          <span>{expanded ? "Hide evidence" : "View evidence"}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {expanded && (
        <div id={id} className="claim-details">
          <p>{verification.explanation}</p>
          {verification.evidence.length ? (
            verification.evidence.map((evidence) => (
              <div className="evidence" key={evidence.id}>
                <span className="trust-tier">{evidence.trustTier} trust</span>
                <blockquote>{evidence.excerpt}</blockquote>
                <p>
                  <strong>{evidence.title}</strong>
                  <span>
                    {evidence.publisher} · {new URL(evidence.url).hostname}
                  </span>
                </p>
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open source: ${evidence.title} (opens in new tab)`}
                >
                  Open source <ExternalLink aria-hidden="true" />
                </a>
              </div>
            ))
          ) : (
            <div className="partial-note" role="note">
              <TriangleAlert aria-hidden="true" />
              <span>
                <strong>Source unavailable</strong>
                This claim could not be fully verified. The rest of the analysis
                is complete.
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
