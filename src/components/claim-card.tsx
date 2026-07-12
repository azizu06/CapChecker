import { ChevronDown, TriangleAlert } from "lucide-react";

import type { Evidence, OpinionClaim, Verification } from "@/domain/analysis";
import { formatTimestamp } from "@/lib/format-timestamp";

import { ExternalLinkLabel } from "./external-link-label";

const verdictPills = {
  true: { label: "True", tone: "v-true" },
  "mostly-true": { label: "Mostly true", tone: "v-mostly" },
  unverifiable: { label: "Unverifiable", tone: "v-unv" },
  false: { label: "False", tone: "v-false" },
} as const;

const tierLabels = {
  primary: "Primary source",
  high: "High trust",
  medium: "Medium trust",
  low: "Low trust",
} as const;

const Chevron = () => <ChevronDown className="chev" aria-hidden="true" />;

const ClaimMeta = ({
  timestampSeconds,
  trailing,
}: {
  timestampSeconds?: number;
  trailing: string;
}) => (
  <span className="claim-meta">
    {timestampSeconds !== undefined && (
      <>
        <time dateTime={`PT${timestampSeconds}S`}>
          {formatTimestamp(timestampSeconds)}
        </time>
        {" · "}
      </>
    )}
    {trailing}
  </span>
);

const EvidenceBlock = ({ evidence }: { evidence: Evidence }) => (
  <div className="evidence">
    <blockquote>“{evidence.excerpt}”</blockquote>
    <footer>
      <span className={`tier${evidence.trustTier === "low" ? " tier-low" : ""}`}>
        {tierLabels[evidence.trustTier]}
      </span>
      <a
        href={evidence.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open source: ${evidence.title} (opens in new tab)`}
      >
        <ExternalLinkLabel text={`${evidence.publisher} — ${evidence.title}`} />
      </a>
    </footer>
  </div>
);

type ClaimCardProps =
  | { verification: Verification; skippedClaim?: never }
  | { verification?: never; skippedClaim: OpinionClaim };

export function ClaimCard(props: ClaimCardProps) {
  if (props.skippedClaim) {
    const claim = props.skippedClaim;
    return (
      <article className="claim opinion">
        <div className="claim-summary">
          <span className="verdict-pill v-skip">Opinion</span>
          <span className="claim-text">{claim.text}</span>
          <ClaimMeta
            timestampSeconds={claim.timestampSeconds}
            trailing="skipped"
          />
        </div>
      </article>
    );
  }

  const { verification } = props;
  const pill = verdictPills[verification.verdict];

  return (
    <details className="claim">
      <summary>
        <span className={`verdict-pill ${pill.tone}`}>{pill.label}</span>
        <span className="claim-text">{verification.claim.text}</span>
        <ClaimMeta
          timestampSeconds={verification.claim.timestampSeconds}
          trailing={`${Math.round(verification.confidence * 100)}%`}
        />
        <Chevron />
      </summary>
      <div className="claim-body">
        <p>{verification.explanation}</p>
        {verification.evidence.length ? (
          verification.evidence.map((evidence) => (
            <EvidenceBlock key={evidence.id} evidence={evidence} />
          ))
        ) : (
          <div className="partial-note" role="note">
            <TriangleAlert aria-hidden="true" />
            <span>
              <strong>Source unavailable</strong>
              This claim could not be fully verified. The rest of the analysis is
              complete.
            </span>
          </div>
        )}
      </div>
    </details>
  );
}
