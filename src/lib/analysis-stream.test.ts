import { describe, expect, it } from "vitest";

import type { AnalysisEvent } from "@/domain/analysis";

import { AnalysisStreamError, parseAnalysisStream } from "./analysis-stream";

const responseFromChunks = (chunks: Uint8Array[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );

describe("parseAnalysisStream", () => {
  it("reconstructs contract-valid SSE events split at every byte boundary", async () => {
    const expected: AnalysisEvent[] = [
      {
        type: "progress",
        stage: "fetching",
        message: "Loading creator’s café video",
      },
      {
        type: "progress",
        stage: "processing",
        message: "Preparing analysis",
      },
    ];
    const wire = expected
      .map((event) => `event: analysis\r\ndata: ${JSON.stringify(event)}\r\n\r\n`)
      .join("");
    const bytes = new TextEncoder().encode(wire);
    const chunks = Array.from(bytes, (byte) => Uint8Array.of(byte));
    const actual: AnalysisEvent[] = [];

    for await (const event of parseAnalysisStream(responseFromChunks(chunks))) {
      actual.push(event);
    }

    expect(actual).toEqual(expected);
  });

  it("ignores legal SSE metadata and rejects unsafe payloads with a safe error", async () => {
    const validEvent: AnalysisEvent = {
      type: "progress",
      stage: "fetching",
      message: "Loading video",
    };
    const encoder = new TextEncoder();
    const response = responseFromChunks([
      encoder.encode(
        `: keep-alive\nid: 7\nevent: analysis\nretry: 1000\ndata: ${JSON.stringify(validEvent)}\n\n`,
      ),
      encoder.encode("data: {\"type\":\"complete\",\"secret\":\"/tmp/key\"}\n\n"),
    ]);
    const events: AnalysisEvent[] = [];
    let caught: unknown;

    try {
      for await (const event of parseAnalysisStream(response)) events.push(event);
    } catch (error) {
      caught = error;
    }

    expect(events).toEqual([validEvent]);
    expect(caught).toBeInstanceOf(AnalysisStreamError);
    expect((caught as Error).message).toBe(
      "CapCheck received an invalid analysis response. Please try again.",
    );
    expect((caught as Error).message).not.toContain("/tmp/key");
  });

  it("turns malformed JSON into the same safe client-visible error", async () => {
    const response = responseFromChunks([
      new TextEncoder().encode("data: {not-json:/Users/private/key}\n\n"),
    ]);

    const consume = async () => {
      for await (const event of parseAnalysisStream(response)) {
        void event;
      }
    };

    await expect(consume()).rejects.toEqual(
      new AnalysisStreamError(
        "CapCheck received an invalid analysis response. Please try again.",
      ),
    );
  });

  it("does not expose a low-level stream failure to the client", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error("read failed at /tmp/private/key"));
        },
      }),
    );

    const consume = async () => {
      for await (const event of parseAnalysisStream(response)) void event;
    };

    await expect(consume()).rejects.toEqual(new AnalysisStreamError());
  });
});
