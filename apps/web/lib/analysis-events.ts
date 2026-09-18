import type { CityModel } from "@codecity/city-layout";
import type { Finding } from "@codecity/graph-core";
import type { GitHubAnalysisProgress, GitHubIngestionErrorCode } from "@codecity/repository-ingestion";

export type AnalysisStreamEvent =
  | { type: "progress"; progress: GitHubAnalysisProgress }
  | { type: "result"; model: CityModel; findings: Finding[] }
  | { type: "error"; code: GitHubIngestionErrorCode | "INVALID_REQUEST" | "INTERNAL_ERROR"; message: string };

export function parseAnalysisEventLine(line: string): AnalysisStreamEvent {
  const parsed = JSON.parse(line) as unknown;
  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    throw new Error("Invalid analysis event payload.");
  }
  const type = (parsed as { type?: unknown }).type;
  if (type !== "progress" && type !== "result" && type !== "error") {
    throw new Error("Unknown analysis event type.");
  }
  return parsed as AnalysisStreamEvent;
}
