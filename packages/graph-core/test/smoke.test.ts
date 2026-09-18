import { describe, expect, it } from "vitest";
import { GRAPH_SCHEMA_VERSION } from "../src/index.js";

describe("graph-core", () => {
  it("exports the V1 schema version", () => {
    expect(GRAPH_SCHEMA_VERSION).toBe("1.0.0");
  });
});
