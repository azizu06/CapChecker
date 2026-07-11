import { AnalysisEventSchema, type AnalysisEvent } from "@/domain/analysis";

const INVALID_STREAM_MESSAGE =
  "CapCheck received an invalid analysis response. Please try again.";

export class AnalysisStreamError extends Error {
  constructor(message = INVALID_STREAM_MESSAGE) {
    super(message);
    this.name = "AnalysisStreamError";
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

const decodeFrame = (frame: string): AnalysisEvent | undefined => {
  const data = frame
    .split(/\r\n|\n|\r/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");

  if (!data) return undefined;

  try {
    return AnalysisEventSchema.parse(JSON.parse(data));
  } catch {
    throw new AnalysisStreamError();
  }
};

export async function* parseAnalysisStream(
  response: Response,
): AsyncGenerator<AnalysisEvent> {
  if (!response.ok || !response.body) {
    throw new AnalysisStreamError(
      "CapCheck could not start this analysis. Please try again.",
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
  } catch (error) {
    if (error instanceof AnalysisStreamError) throw error;
    throw new AnalysisStreamError();
  } finally {
    reader.releaseLock();
  }
}
