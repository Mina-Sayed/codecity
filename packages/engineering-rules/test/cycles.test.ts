import { describe, expect, it } from "vitest";
import { findCircularDependencies } from "../src/index.js";
import { graphWithFiles } from "./test-helpers.js";

describe("circular dependencies", () => {
  it("finds one SCC and excludes a one-way leaf", () => {
    const graph = graphWithFiles(["a", "b", "c", "leaf"], [
      ["a", "b"], ["b", "c"], ["c", "a"], ["leaf", "a"],
    ]);
    const findings = findCircularDependencies(graph);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.nodeIds).toEqual(["file:a", "file:b", "file:c"]);
  });
});
