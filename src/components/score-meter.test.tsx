import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScoreMeter } from "./score-meter";

describe("ScoreMeter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the clamped final pin position immediately with reduced motion", () => {
    const requestFrame = vi.fn().mockReturnValue(1);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true }),
    );
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { container } = render(<ScoreMeter score={140} />);

    expect(container.querySelector(".meter .pin")).toHaveStyle({ left: "100%" });
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
