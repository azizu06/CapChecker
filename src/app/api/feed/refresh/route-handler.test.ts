import { describe, expect, it } from "vitest";

import type { RefreshEvent } from "@/server/feed/refresh/events";

import { createRefreshHandler } from "./route-handler";

describe("feed refresh route handler", () => {
  it("passes a pre-cancelled request's exact abort reason to the runner", async () => {
    const reason = new DOMException("navigation cancelled", "AbortError");
    const requestController = new AbortController();
    requestController.abort(reason);
    let observedReason: unknown;
    const handler = createRefreshHandler({
      getRunner: () => ({
        async *run(signal): AsyncGenerator<RefreshEvent> {
          observedReason = signal.reason;
        },
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/feed/refresh", {
        method: "POST",
        signal: requestController.signal,
      }),
    );
    await response.text();

    expect(observedReason).toBe(reason);
  });

  it("propagates mid-stream cancellation and closes the runner generator", async () => {
    const reason = new DOMException("reader stopped", "AbortError");
    let observedReason: unknown;
    let markCleaned!: () => void;
    const cleaned = new Promise<void>((resolve) => {
      markCleaned = resolve;
    });
    const handler = createRefreshHandler({
      getRunner: () => ({
        async *run(signal): AsyncGenerator<RefreshEvent> {
          try {
            yield { type: "stage", stage: "discovering", message: "Searching" };
            await new Promise<void>((_resolve, reject) => {
              signal.addEventListener(
                "abort",
                () => {
                  observedReason = signal.reason;
                  reject(signal.reason);
                },
                { once: true },
              );
            });
          } finally {
            markCleaned();
          }
        },
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/feed/refresh", { method: "POST" }),
    );
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel(reason);
    await cleaned;

    expect(observedReason).toBe(reason);
  });
});
