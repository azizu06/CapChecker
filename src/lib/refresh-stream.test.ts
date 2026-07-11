import { describe, expect, it } from "vitest";

import { parseRefreshStream, RefreshStreamError } from "./refresh-stream";

const sse = (payloads: object[]) =>
  new Response(
    payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join(""),
    { headers: { "content-type": "text/event-stream" } },
  );

describe("parseRefreshStream", () => {
  it("yields typed stage and complete events", async () => {
    const response = sse([
      { type: "stage", stage: "discovering", message: "Searching" },
      {
        type: "complete",
        status: "completed",
        counts: { discovered: 1, analyzed: 1, kept: 1, rejected: 0, duplicate: 0 },
        accepted: {
          youtubeVideoId: "v1",
          title: "T",
          category: "investing",
          capScore: 8,
          tldr: "TLDR",
          inserted: true,
        },
      },
    ]);

    const events = [];
    for await (const event of parseRefreshStream(response)) events.push(event);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: "stage", stage: "discovering" });
    expect(events[1]).toMatchObject({ type: "complete", status: "completed" });
  });

  it("throws on a malformed frame", async () => {
    const response = new Response("data: {not json}\n\n", {
      headers: { "content-type": "text/event-stream" },
    });
    const iterate = async () => {
      for await (const _event of parseRefreshStream(response)) void _event;
    };
    await expect(iterate()).rejects.toBeInstanceOf(RefreshStreamError);
  });

  it("throws when the response is not ok", async () => {
    await expect(async () => {
      for await (const _event of parseRefreshStream(
        new Response(null, { status: 500 }),
      ))
        void _event;
    }).rejects.toBeInstanceOf(RefreshStreamError);
  });
});
