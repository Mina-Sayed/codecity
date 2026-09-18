import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectGraph } from "@codecity/graph-core";
import { deriveBuildingSize, groupFilesIntoDistricts } from "../src/index.js";

async function fixture(): Promise<ProjectGraph> {
  return JSON.parse(
    await readFile(resolve(import.meta.dirname, "../../../fixtures/simple-ts/expected.project-graph.json"), "utf8"),
  ) as ProjectGraph;
}

describe("city grouping", () => {
  it("groups files by physical folder with stable ordering", async () => {
    const graph = await fixture();
    const groups = groupFilesIntoDistricts(graph);
    const src = groups.find((group) => group.path === "src");
    const shared = groups.find((group) => group.path === "src/shared");
    const base = graph.files.find((file) => file.path === "src/shared/base-service.ts");

    expect(src).toBeDefined();
    expect(shared?.fileIds).toContain(base?.id);
    expect(groups.map((group) => group.id)).toEqual([...groups.map((group) => group.id)].sort());
    expect(groups.every((group) => group.fileIds.every((id, index, ids) => index === 0 || ids[index - 1]! <= id))).toBe(true);
  });

  it("derives bounded positive building dimensions", async () => {
    const graph = await fixture();
    const file = graph.files.find((candidate) => candidate.path === "src/order-service.ts")!;
    const size = deriveBuildingSize(file, graph);

    expect(size.x).toBeGreaterThan(0);
    expect(size.y).toBeGreaterThan(0);
    expect(size.z).toBeGreaterThan(0);
    expect(size.x).toBeLessThanOrEqual(5);
    expect(size.y).toBeLessThanOrEqual(20);
  });

  it("increases height when LOC or complexity grows", async () => {
    const graph = await fixture();
    const base = graph.files[0]!;
    const small = deriveBuildingSize({ ...base, loc: 10, complexity: { cyclomatic: 1, maxNesting: 0 } }, graph);
    const larger = deriveBuildingSize({ ...base, loc: 200, complexity: { cyclomatic: 8, maxNesting: 4 } }, graph);

    expect(larger.y).toBeGreaterThan(small.y);
  });
});
