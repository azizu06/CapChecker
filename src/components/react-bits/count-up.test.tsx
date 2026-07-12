import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CountUp } from "./count-up";

describe("CountUp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a stable server-compatible value when animation is disabled", () => {
    const requestFrame = vi.fn().mockReturnValue(1);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(<CountUp to={28} animate={false} />);

    expect(screen.getByText("28")).toBeVisible();
    expect(requestFrame).not.toHaveBeenCalled();
  });
});
