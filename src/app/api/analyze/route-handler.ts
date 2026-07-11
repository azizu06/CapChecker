import {
  AnalysisEventSchema,
  HttpUrlSchema,
  UploadFileNameSchema,
  type AnalysisEvent,
} from "@/domain/analysis";
import {
  streamFixtureAnalysis,
  type FixtureScenario,
} from "@/server/analysis/fixture-adapter";
import type { VideoIngestionSource } from "@/server/ingestion/video-ingestion";

const scenarios = new Set<FixtureScenario>([
  "mixed",
  "scammy",
  "legitimate",
  "partialFailure",
  "fatal",
]);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const UPLOAD_TOO_LARGE_MESSAGE = "Video uploads must be 50 MB or smaller.";

const errorResponse = (
  status: number,
  message: string,
  code = "INVALID_INPUT",
) =>
  Response.json(
    { error: { code, message, retryable: false } },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );

const parseScenario = (value: unknown): FixtureScenario | "invalid" => {
  if (value === undefined || value === null || value === "") return "mixed";
  return typeof value === "string" && scenarios.has(value as FixtureScenario)
    ? (value as FixtureScenario)
    : "invalid";
};

const encodeEvent = (event: AnalysisEvent) =>
  new TextEncoder().encode(
    `data: ${JSON.stringify(AnalysisEventSchema.parse(event))}\n\n`,
  );

const safeStreamError: AnalysisEvent = {
  type: "error",
  error: {
    code: "ANALYSIS_FAILED",
    message: "CapCheck could not finish this analysis. Please try again.",
    retryable: true,
  },
};

export type AnalysisStream = (
  source: VideoIngestionSource,
  signal: AbortSignal,
) => AsyncGenerator<AnalysisEvent>;

type AnalyzeHandlerDependencies = {
  createLiveStream(): AnalysisStream;
};

export function createAnalyzeHandler({
  createLiveStream,
}: AnalyzeHandlerDependencies) {
  return async function analyze(request: Request): Promise<Response> {
    const fixtureMode =
      process.env.CAPCHECK_ANALYSIS_MODE === "fixture" &&
      process.env.NODE_ENV !== "production";
    const contentType = request.headers.get("content-type") ?? "";
    let scenario: FixtureScenario | "invalid" = "mixed";
    let source: VideoIngestionSource;

    if (contentType.includes("application/json")) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errorResponse(400, "Enter a valid request.");
      }
      const bodyRecord =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : {};
      const url = bodyRecord.url;
      scenario = parseScenario(bodyRecord.scenario);
      if (typeof url !== "string" || url.length === 0) {
        return errorResponse(400, "A video URL is required.");
      }
      if (!HttpUrlSchema.safeParse(url).success) {
        return errorResponse(400, "Enter a valid HTTP or HTTPS video URL.");
      }
      source = { kind: "url", url };
    } else if (contentType.includes("multipart/form-data")) {
      const contentLength = request.headers.get("content-length");
      if (
        contentLength !== null &&
        /^\d+$/.test(contentLength) &&
        Number(contentLength) > MAX_UPLOAD_BYTES
      ) {
        return errorResponse(
          413,
          UPLOAD_TOO_LARGE_MESSAGE,
          "PAYLOAD_TOO_LARGE",
        );
      }

      // Chunked requests have no trustworthy length to preflight. The Web
      // Request API buffers multipart parsing, so deployments should enforce
      // the same limit at their edge as well as using this post-parse check.
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return errorResponse(400, "Choose a valid video file.");
      }
      const file = form.get("file");
      scenario = parseScenario(form.get("scenario"));
      if (!file || typeof file === "string" || file.size === 0) {
        return errorResponse(400, "Choose a video file.");
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return errorResponse(
          413,
          UPLOAD_TOO_LARGE_MESSAGE,
          "PAYLOAD_TOO_LARGE",
        );
      }
      if (!UploadFileNameSchema.safeParse(file.name).success) {
        return errorResponse(
          400,
          "Choose a video file without a path in its name.",
        );
      }
      source = {
        kind: "upload",
        fileName: file.name,
        mimeType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      };
    } else {
      return errorResponse(415, "Submit a video URL or upload a video file.");
    }

    if (fixtureMode && scenario === "invalid") {
      return errorResponse(400, "Choose a valid analysis scenario.");
    }

    const analysisController = new AbortController();
    const abortAnalysis = () => analysisController.abort();
    let streamCancelled = false;
    if (request.signal.aborted) abortAnalysis();
    request.signal.addEventListener("abort", abortAnalysis, { once: true });

    let eventStream: AsyncGenerator<AnalysisEvent>;
    if (fixtureMode) {
      eventStream = streamFixtureAnalysis(
        { scenario: scenario === "invalid" ? "mixed" : scenario },
        analysisController.signal,
      );
    } else {
      try {
        eventStream = createLiveStream()(source, analysisController.signal);
      } catch {
        request.signal.removeEventListener("abort", abortAnalysis);
        return errorResponse(
          503,
          "Analysis is unavailable right now. Please try again later.",
          "ANALYSIS_UNAVAILABLE",
        );
      }
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of eventStream) {
            controller.enqueue(encodeEvent(event));
          }
        } catch {
          if (!analysisController.signal.aborted && !streamCancelled) {
            controller.enqueue(encodeEvent(safeStreamError));
          }
        } finally {
          request.signal.removeEventListener("abort", abortAnalysis);
          if (!streamCancelled) controller.close();
        }
      },
      cancel() {
        streamCancelled = true;
        analysisController.abort();
        request.signal.removeEventListener("abort", abortAnalysis);
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-store",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no",
        "x-content-type-options": "nosniff",
      },
    });
  };
}
