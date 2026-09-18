import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectGraph } from "@codecity/graph-core";
import { buildCityModel } from "@codecity/city-layout";

async function fixture(): Promise<ProjectGraph> {
  return JSON.parse(
    await readFile(resolve(import.meta.dirname, "../../../fixtures/simple-ts/expected.project-graph.json"), "utf8"),
  ) as ProjectGraph;
}

describe("web CityModel contract", () => {
  it("resolves finding and dependency references to renderable city entities", async () => {
    const graph = await fixture();
    const city = await buildCityModel(graph);
    const buildings = new Set(city.buildings.map((building) => building.id));
    const districts = new Set(city.districts.map((district) => district.id));
    const findings = new Set(graph.findings.map((finding) => finding.id));

    expect(city.buildings.every((building) => building.findingIds.every((id) => findings.has(id)))).toBe(true);
    expect(city.edges.every((edge) => {
      const entitySet = edge.level === "district" ? districts : buildings;
      return entitySet.has(edge.sourceId) && entitySet.has(edge.targetId);
    })).toBe(true);
    expect(city.buildings[0] ? buildings.has(city.buildings[0].id) : true).toBe(true);
  });
});
