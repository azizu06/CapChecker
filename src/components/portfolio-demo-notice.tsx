import { Archive } from "lucide-react";
import Link from "next/link";

export function PortfolioDemoNotice({
  feature,
}: {
  feature: "analyzer" | "refresh";
}) {
  const analyzer = feature === "analyzer";

  return (
    <section className="feed-state portfolio-demo-notice" aria-labelledby="demo-status">
      <Archive aria-hidden="true" />
      <div>
        <p className="kicker">Archived portfolio demo</p>
        <h2 id="demo-status">
          {analyzer ? "Live analysis is retired" : "The catalog is now read-only"}
        </h2>
        <p>
          {analyzer
            ? "The hackathon API integrations have been safely deactivated. The verified catalog, scorecards, citations, and video details remain available to explore."
            : "Live refresh has been safely deactivated after the hackathon. Browse the persisted CapCheck-vetted videos and their evidence-backed scorecards below."}
        </p>
        {analyzer && (
          <Link className="feed-state-action" href="/">
            Browse the verified feed
          </Link>
        )}
      </div>
    </section>
  );
}
