import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressTimeline } from "./progress-timeline";

describe("ProgressTimeline", () => {
  it("shows contract stages in order with completed, current, and future labels", () => {
    render(<ProgressTimeline progress={[
      { stage: "fetching", message: "Video fetched" },
      { stage: "processing", message: "Preparing transcript" },
    ]} />);

    const region = screen.getByRole("region", { name: /checking the claims/i });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "FetchingComplete",
      "ProcessingPreparing transcript",
      "ExtractingWaiting",
      "VerifyingWaiting",
      "SynthesizingWaiting",
      "CompleteWaiting",
    ]);
  });
});
