import { describe, expect, it } from "vitest";
import { layoutDistricts } from "../src/index.js";

it("returns deterministic district coordinates", async () => {
  const nodes = [
    { id: "district:b", width: 20, depth: 10 },
    { id: "district:a", width: 30, depth: 12 },
  ];
  const edges = [
    { id: "edge:a-b", sourceId: "district:a", targetId: "district:b", weight: 2, level: "district" as const },
  ];

  expect(await layoutDistricts(nodes, edges)).toEqual(await layoutDistricts(nodes, edges));
});
