import { describe, expect, it } from "vitest";
import { findHotspotFindings } from "../src/index.js";
import { graphWithFiles } from "./test-helpers.js";

describe("hotspots", () => {
  it("uses relative distributions and conservative possible-unused wording", () => {
    const graph = graphWithFiles(["index", "normal", "hot"], [["index", "normal"]]);
    graph.files.find((file) => file.id === "file:index")!.entrypoint = true;
    graph.files.find((file) => file.id === "file:hot")!.complexity.cyclomatic = 20;
    graph.files.find((file) => file.id === "file:hot")!.loc = 500;
    graph.files.find((file) => file.id === "file:hot")!.symbolIds = ["s1", "s2", "s3"];

    const findings = findHotspotFindings(graph);
    expect(findings.some((item) => item.ruleId === "complexity-hotspot" && item.nodeIds[0] === "file:hot")).toBe(true);
    expect(findings.some((item) => item.ruleId === "large-module" && item.nodeIds[0] === "file:hot")).toBe(true);
    expect(findings.some((item) => item.ruleId === "possible-unused-file" && item.nodeIds[0] === "file:index")).toBe(false);
    expect(findings.filter((item) => item.ruleId === "possible-unused-file").every((item) => item.title.includes("Possible"))).toBe(true);
  });
});
