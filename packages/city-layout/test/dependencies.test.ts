import { describe, expect, it } from "vitest";
import type { ProjectGraph } from "@codecity/graph-core";
import { aggregateDistrictDependencies, type DistrictGroup } from "../src/index.js";

const districts: DistrictGroup[] = [
  { id: "district:a", name: "a", path: "src/a", fileIds: ["file:a1", "file:a2"] },
  { id: "district:b", name: "b", path: "src/b", fileIds: ["file:b1"] },
];

it("aggregates repeated file dependencies into one weighted district road", () => {
  const graph = {
    edges: [
      { id: "e1", kind: "imports", source: "file:a1", target: "file:b1", confidence: "high" },
      { id: "e2", kind: "imports", source: "file:a2", target: "file:b1", confidence: "high" },
    ],
  } as ProjectGraph;

  expect(aggregateDistrictDependencies(graph, districts)).toMatchObject([
    { sourceId: "district:a", targetId: "district:b", weight: 2, level: "district" },
  ]);
});
