import { CAP_LABELS, type CapLabel } from "@/domain/feed";

const toneClass: Record<CapLabel, string> = {
  "no-cap": "good-c",
  "some-cap": "warn-c",
  "full-of-cap": "bad-c",
};

export function CapScorePill({
  capScore,
  capLabel,
}: {
  capScore: number;
  capLabel: CapLabel;
}) {
  return (
    <span
      className={`cap-pill ${toneClass[capLabel]}`}
      aria-label={`Cap Score ${capScore} out of 100 — ${CAP_LABELS[capLabel]}`}
    >
      <span className="cap-pill-score">{capScore}</span>
      {CAP_LABELS[capLabel]}
    </span>
  );
}
