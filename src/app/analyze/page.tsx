import type { Metadata } from "next";

import { CapCheckApp } from "@/components/capcheck-app";
import { PortfolioDemoNotice } from "@/components/portfolio-demo-notice";
import { isPortfolioDemoMode } from "@/lib/portfolio-mode";

export const metadata: Metadata = {
  title: "Analyze — CapCheck",
  description: "Check a short-form finance video against credible evidence.",
};

export default function AnalyzePage() {
  if (isPortfolioDemoMode()) {
    return (
      <main className="feed-page portfolio-demo-page">
        <PortfolioDemoNotice feature="analyzer" />
      </main>
    );
  }

  return <CapCheckApp />;
}
