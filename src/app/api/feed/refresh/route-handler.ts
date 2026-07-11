import { RefreshEventSchema, type RefreshEvent } from "@/server/feed/refresh/events";

const encodeEvent = (event: RefreshEvent) =>
  new TextEncoder().encode(
    `data: ${JSON.stringify(RefreshEventSchema.parse(event))}\n\n`,
  );

const safeStreamError: RefreshEvent = {
  type: "error",
  error: {
    code: "REFRESH_FAILED",
    message:
      "CapCheck could not finish the feed refresh. The existing feed is unchanged — please try again.",
    retryable: true,
  },
};

const errorResponse = (status: number, message: string, code: string) =>
  Response.json(
    { error: { code, message, retryable: true } },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );

export type RefreshRunner = {
  run(signal: AbortSignal): AsyncGenerator<RefreshEvent>;
};

type RefreshHandlerDependencies = {
  /** Returns the process-wide runner. Throwing signals an unconfigured feed. */
  getRunner(): RefreshRunner;
};

/**
 * POST handler that streams refresh progress as Server-Sent Events, matching
 * the analyze route's SSE contract: `stage` events, then one terminal
 * `complete` (with counts) or `error` event. Single-flight is enforced inside
 * the runner, so a concurrent POST simply streams a REFRESH_IN_PROGRESS error.
 */
export function createRefreshHandler({ getRunner }: RefreshHandlerDependencies) {
  return async function refresh(request: Request): Promise<Response> {
    let runner: RefreshRunner;
    try {
      runner = getRunner();
    } catch {
      return errorResponse(
        503,
        "Feed refresh is unavailable right now. Please try again later.",
        "REFRESH_UNAVAILABLE",
      );
    }

    const refreshController = new AbortController();
    const abortRefresh = () => refreshController.abort();
    let streamCancelled = false;
    if (request.signal.aborted) abortRefresh();
    request.signal.addEventListener("abort", abortRefresh, { once: true });

    const eventStream = runner.run(refreshController.signal);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of eventStream) {
            controller.enqueue(encodeEvent(event));
          }
        } catch {
          if (!refreshController.signal.aborted && !streamCancelled) {
            controller.enqueue(encodeEvent(safeStreamError));
          }
        } finally {
          request.signal.removeEventListener("abort", abortRefresh);
          if (!streamCancelled) controller.close();
        }
      },
      cancel() {
        streamCancelled = true;
        refreshController.abort();
        request.signal.removeEventListener("abort", abortRefresh);
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
