import { describe, expect, it } from "vitest";
import { computeCouplingMetrics, findCouplingFindings } from "../src/index.js";
import { graphWithFiles } from "./test-helpers.js";

describe("coupling", () => {
  it("computes fan-in, fan-out, degree and repository-relative percentile", () => {
    const graph = graphWithFiles(["hub", "a", "b", "c"], [
      ["a", "hub"], ["b", "hub"], ["hub", "c"],
    ]);
    const metric = computeCouplingMetrics(graph).get("file:hub");
    expect(metric).toEqual({ fanIn: 2, fanOut: 1, totalDegree: 3, percentile: 1 });
    expect(findCouplingFindings(graph).some((item) => item.nodeIds[0] === "file:hub")).toBe(true);
  });
});
