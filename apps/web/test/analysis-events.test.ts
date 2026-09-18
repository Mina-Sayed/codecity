import { describe, expect, it } from "vitest";
import { parseAnalysisEventLine } from "../lib/analysis-events";

describe("analysis stream events", () => {
  it("parses progress messages", () => {
    expect(parseAnalysisEventLine('{"type":"progress","progress":{"stage":"fetching_metadata","message":"Resolving"}}')).toEqual({
      type: "progress",
      progress: { stage: "fetching_metadata", message: "Resolving" },
    });
  });

  it("rejects unknown event types", () => {
    expect(() => parseAnalysisEventLine('{"type":"surprise"}')).toThrowError("Unknown analysis event type.");
  });
});
