import { makeEdgeId, type ProjectGraph } from "@codecity/graph-core";
import type { DistrictGroup } from "./grouping.js";
import type { CityEdge } from "./types.js";

const DISTRICT_EDGE_KINDS = new Set(["imports", "reexports"]);

export function aggregateDistrictDependencies(
  graph: ProjectGraph,
  districts: readonly DistrictGroup[],
): CityEdge[] {
  const districtByFile = new Map<string, string>();
  for (const district of districts) {
    for (const fileId of district.fileIds) districtByFile.set(fileId, district.id);
  }

  const weights = new Map<string, { sourceId: string; targetId: string; weight: number }>();

  for (const edge of graph.edges) {
    if (!DISTRICT_EDGE_KINDS.has(edge.kind)) continue;
    const sourceId = districtByFile.get(edge.source);
    const targetId = districtByFile.get(edge.target);
    if (!sourceId || !targetId || sourceId === targetId) continue;
    const key = `${sourceId}\0${targetId}`;
    const current = weights.get(key);
    if (current) current.weight += 1;
    else weights.set(key, { sourceId, targetId, weight: 1 });
  }

  return [...weights.values()]
    .map(({ sourceId, targetId, weight }) => ({
      id: makeEdgeId("city-district-dependency", sourceId, targetId),
      sourceId,
      targetId,
      weight,
      level: "district" as const,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
