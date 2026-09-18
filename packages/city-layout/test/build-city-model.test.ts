import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectGraph } from "@codecity/graph-core";
import { CITY_MODEL_VERSION, buildCityModel } from "../src/index.js";

async function fixture(): Promise<ProjectGraph> {
  return JSON.parse(
    await readFile(resolve(import.meta.dirname, "../../../fixtures/simple-ts/expected.project-graph.json"), "utf8"),
  ) as ProjectGraph;
}

describe("buildCityModel", () => {
  it("turns every source file into exactly one valid building", async () => {
    const graph = await fixture();
    const model = await buildCityModel(graph);
    const fileIds = new Set(graph.files.map((file) => file.id));
    const districtIds = new Set(model.districts.map((district) => district.id));

    expect(model.version).toBe(CITY_MODEL_VERSION);
    expect(model.districts).toHaveLength(2);
    expect(model.buildings).toHaveLength(graph.files.length);
    expect(new Set(model.buildings.map((building) => building.fileId)).size).toBe(graph.files.length);
    expect(model.buildings.every((building) => fileIds.has(building.fileId))).toBe(true);
    expect(model.buildings.every((building) => districtIds.has(building.districtId))).toBe(true);
  });

  it("attaches findings to buildings involved by file or symbol", async () => {
    const graph = await fixture();
    const model = await buildCityModel(graph);
    const buildingByFile = new Map(model.buildings.map((building) => [building.fileId, building]));
    const symbolFile = new Map(graph.symbols.map((symbol) => [symbol.id, symbol.fileId]));

    for (const finding of graph.findings) {
      const involvedFiles = new Set(
        finding.nodeIds.flatMap((nodeId) => {
          if (buildingByFile.has(nodeId)) return [nodeId];
          const fileId = symbolFile.get(nodeId);
          return fileId ? [fileId] : [];
        }),
      );
      for (const fileId of involvedFiles) {
        expect(buildingByFile.get(fileId)?.findingIds).toContain(finding.id);
      }
    }
  });

  it("is deterministic for unchanged graph input", async () => {
    const graph = await fixture();
    expect(await buildCityModel(graph)).toEqual(await buildCityModel(graph));
  });
});
