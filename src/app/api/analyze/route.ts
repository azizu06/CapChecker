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

const scenarios = new Set<FixtureScenario>([
  "mixed",
  "scammy",
  "legitimate",
  "partialFailure",
  "fatal",
]);

const errorResponse = (
  status: number,
  message: string,
  code = "INVALID_INPUT",
) =>
  Response.json(
    { error: { code, message, retryable: false } },
    { status, headers: { "cache-control": "no-store" } },
  );

const parseScenario = (
  value: unknown,
): FixtureScenario | "invalid" => {
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

export async function POST(request: Request): Promise<Response> {
  if (
    process.env.CAPCHECK_ANALYSIS_MODE !== "fixture" ||
    process.env.NODE_ENV === "production"
  ) {
    return errorResponse(
      503,
      "Analysis is unavailable right now. Please try again later.",
      "ANALYSIS_UNAVAILABLE",
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let scenario: FixtureScenario | "invalid" = "mixed";

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
  } else if (contentType.includes("multipart/form-data")) {
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

    if (!UploadFileNameSchema.safeParse(file.name).success) {
      return errorResponse(
        400,
        "Choose a video file without a path in its name.",
      );
    }
  } else {
    return errorResponse(415, "Submit a video URL or upload a video file.");
  }

  if (scenario === "invalid") {
    return errorResponse(400, "Choose a valid analysis scenario.");
  }

  const analysisController = new AbortController();
  const abortAnalysis = () => analysisController.abort();
  request.signal.addEventListener("abort", abortAnalysis, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamFixtureAnalysis(
          { scenario },
          analysisController.signal,
        )) {
          controller.enqueue(encodeEvent(event));
        }
      } catch {
        if (!analysisController.signal.aborted) {
          controller.enqueue(encodeEvent(safeStreamError));
        }
      } finally {
        request.signal.removeEventListener("abort", abortAnalysis);
        controller.close();
      }
    },
    cancel() {
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
    },
  });
}
