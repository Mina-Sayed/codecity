import "server-only";

import { buildCityModel } from "@codecity/city-layout";
import { GitHubIngestionError, analyzePublicGitHubRepository } from "@codecity/repository-ingestion/web";
import type { AnalysisStreamEvent } from "../../../lib/analysis-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 4_096;
const encoder = new TextEncoder();

function encode(event: AnalysisStreamEvent): Uint8Array {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

function safeEnqueue(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: AnalysisStreamEvent,
  signal: AbortSignal,
): void {
  if (signal.aborted) return;
  try {
    controller.enqueue(encode(event));
  } catch {
    // The client disconnected or cancelled the stream.
  }
}

function requestError(message: string, status: number): Response {
  return Response.json(
    { type: "error", code: "INVALID_REQUEST", message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return requestError("Request body is too large.", 413);
  }

  let repositoryUrl: string;
  try {
    const rawBody = await request.text();
    if (encoder.encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return requestError("Request body is too large.", 413);
    }
    const body = JSON.parse(rawBody) as { repositoryUrl?: unknown };
    if (typeof body.repositoryUrl !== "string" || body.repositoryUrl.length === 0 || body.repositoryUrl.length > 512) {
      return requestError("repositoryUrl must be a non-empty GitHub repository URL.", 400);
    }
    repositoryUrl = body.repositoryUrl;
  } catch {
    return requestError("Request body must be valid JSON.", 400);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        try {
          const token = process.env.GITHUB_TOKEN;
          const graph = await analyzePublicGitHubRepository(repositoryUrl, {
            ...(token ? { token } : {}),
            signal: request.signal,
            onProgress: (progress) => {
              safeEnqueue(controller, { type: "progress", progress }, request.signal);
            },
          });
          const model = await buildCityModel(graph);
          safeEnqueue(controller, { type: "result", model, findings: graph.findings }, request.signal);
        } catch (error) {
          if (request.signal.aborted) return;
          if (error instanceof GitHubIngestionError) {
            safeEnqueue(controller, { type: "error", code: error.code, message: error.message }, request.signal);
          } else {
            safeEnqueue(controller, { type: "error", code: "INTERNAL_ERROR", message: "CodeCity could not analyze this repository." }, request.signal);
          }
        } finally {
          try { controller.close(); } catch { /* stream already cancelled */ }
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
