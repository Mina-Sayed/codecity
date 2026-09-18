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
            onProgress: (progress) => {
              controller.enqueue(encode({ type: "progress", progress }));
            },
          });
          const model = await buildCityModel(graph);
          controller.enqueue(encode({ type: "result", model, findings: graph.findings }));
        } catch (error) {
          if (error instanceof GitHubIngestionError) {
            controller.enqueue(encode({ type: "error", code: error.code, message: error.message }));
          } else {
            controller.enqueue(encode({ type: "error", code: "INTERNAL_ERROR", message: "CodeCity could not analyze this repository." }));
          }
        } finally {
          controller.close();
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
