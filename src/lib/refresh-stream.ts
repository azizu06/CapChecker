import { RefreshEventSchema, type RefreshEvent } from "@/server/feed/refresh/events";

const INVALID_STREAM_MESSAGE =
  "CapCheck received an invalid refresh response. Please try again.";

export class RefreshStreamError extends Error {
  constructor(message = INVALID_STREAM_MESSAGE) {
    super(message);
    this.name = "RefreshStreamError";
  }
}

const readFrame = (buffer: string): [string, string] | undefined => {
  const boundary = /\r\n\r\n|\n\n|\r\r/.exec(buffer);
  if (!boundary) return undefined;
  return [
    buffer.slice(0, boundary.index),
    buffer.slice(boundary.index + boundary[0].length),
  ];
};

const decodeFrame = (frame: string): RefreshEvent | undefined => {
  const data = frame
    .split(/\r\n|\n|\r/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");

  if (!data) return undefined;

  try {
    return RefreshEventSchema.parse(JSON.parse(data));
  } catch {
    throw new RefreshStreamError();
  }
};

/**
 * Parses the feed-refresh SSE stream into typed `RefreshEvent`s. Mirrors
 * `parseAnalysisStream` so Lane B's feed UI can consume refresh progress the
 * same way the analyzer UI consumes analysis progress.
 */
export async function* parseRefreshStream(
  response: Response,
): AsyncGenerator<RefreshEvent> {
  if (!response.ok || !response.body) {
    throw new RefreshStreamError(
      "CapCheck could not start the feed refresh. Please try again.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let nextFrame = readFrame(buffer);
      while (nextFrame) {
        const [frame, remaining] = nextFrame;
        buffer = remaining;
        const event = decodeFrame(frame);
        if (event) yield event;
        nextFrame = readFrame(buffer);
      }

      if (done) break;
    }

    if (buffer.trim().length > 0) throw new RefreshStreamError();
  } catch (error) {
    if (error instanceof RefreshStreamError) throw error;
    throw new RefreshStreamError();
  } finally {
    reader.releaseLock();
  }
}
