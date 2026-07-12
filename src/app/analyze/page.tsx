import type { Metadata } from "next";

import { CapCheckApp } from "@/components/capcheck-app";
import { isPortfolioDemoMode } from "@/lib/portfolio-mode";

export const metadata: Metadata = {
  title: "Analyze — CapCheck",
  description: "Check a short-form finance video against credible evidence.",
};

export default function AnalyzePage() {
  return <CapCheckApp readOnly={isPortfolioDemoMode()} />;
}
