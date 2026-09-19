import { makeEdgeId, makeNodeId, type FileNode, type ProjectGraph } from "@codecity/graph-core";
import { aggregateDistrictDependencies } from "./dependencies.js";
import { groupFilesIntoDistricts } from "./grouping.js";
import { layoutDistricts } from "./elk-layout.js";
import { deriveBuildingSize } from "./metrics.js";
import { packDistrictBuildings } from "./packing.js";
import {
  CITY_MODEL_VERSION,
  type CityBounds,
  type CityBuilding,
  type CityDistrict,
  type CityEdge,
  type CityModel,
  type Vec3,
} from "./types.js";

const GROUND_HEIGHT = 0.5;

function buildingId(file: FileNode): string {
  return makeNodeId("city-building", file.path);
}

function findingIdsForFile(graph: ProjectGraph, file: FileNode): string[] {
  const nodeIds = new Set([file.id, ...file.symbolIds]);
  return graph.findings
    .filter((finding) => finding.nodeIds.some((nodeId) => nodeIds.has(nodeId)))
    .map((finding) => finding.id)
    .sort();
}

function fileEdges(graph: ProjectGraph, buildingByFile: ReadonlyMap<string, string>): CityEdge[] {
  return graph.edges
    .filter((edge) => edge.kind === "imports" || edge.kind === "reexports")
    .flatMap((edge) => {
      const sourceId = buildingByFile.get(edge.source);
      const targetId = buildingByFile.get(edge.target);
      if (!sourceId || !targetId || sourceId === targetId) return [];
      return [{
        id: makeEdgeId("city-file-dependency", sourceId, targetId),
        sourceId,
        targetId,
        weight: 1,
        level: "file" as const,
      }];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function calculateBounds(districts: readonly CityDistrict[], buildings: readonly CityBuilding[]): CityBounds {
  if (districts.length === 0 && buildings.length === 0) {
    const origin = { x: 0, y: 0, z: 0 };
    return { min: origin, max: origin };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = 0;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = 0;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const district of districts) {
    minX = Math.min(minX, district.position.x - district.size.x / 2);
    minZ = Math.min(minZ, district.position.z - district.size.z / 2);
    maxX = Math.max(maxX, district.position.x + district.size.x / 2);
    maxZ = Math.max(maxZ, district.position.z + district.size.z / 2);
  }
  for (const building of buildings) {
    minX = Math.min(minX, building.position.x - building.size.x / 2);
    minY = Math.min(minY, building.position.y - building.size.y / 2);
    minZ = Math.min(minZ, building.position.z - building.size.z / 2);
    maxX = Math.max(maxX, building.position.x + building.size.x / 2);
    maxY = Math.max(maxY, building.position.y + building.size.y / 2);
    maxZ = Math.max(maxZ, building.position.z + building.size.z / 2);
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function center(bounds: CityBounds): Vec3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
}

export async function buildCityModel(graph: ProjectGraph): Promise<CityModel> {
  const groups = groupFilesIntoDistricts(graph);
  const filesById = new Map(graph.files.map((file) => [file.id, file]));
  const packingByDistrict = new Map<
    string,
    ReturnType<typeof packDistrictBuildings>
  >();

  for (const group of groups) {
    const descriptors = group.fileIds.flatMap((fileId) => {
      const file = filesById.get(fileId);
      if (!file) return [];
      return [{ id: buildingId(file), size: deriveBuildingSize(file, graph) }];
    });
    packingByDistrict.set(group.id, packDistrictBuildings(descriptors, { groundHeight: GROUND_HEIGHT }));
  }

  const districtEdges = aggregateDistrictDependencies(graph, groups);
  const layout = await layoutDistricts(
    groups.map((group) => {
      const packed = packingByDistrict.get(group.id)!;
      return { id: group.id, width: packed.size.x, depth: packed.size.z };
    }),
    districtEdges,
  );
  const layoutById = new Map(layout.map((district) => [district.id, district]));

  const districts: CityDistrict[] = groups.map((group) => {
    const packed = packingByDistrict.get(group.id)!;
    const placed = layoutById.get(group.id) ?? { position: { x: 0, y: 0, z: 0 } };
    return {
      id: group.id,
      name: group.name,
      path: group.path,
      position: {
        x: placed.position.x + packed.size.x / 2,
        y: GROUND_HEIGHT / 2,
        z: placed.position.z + packed.size.z / 2,
      },
      size: packed.size,
      buildingIds: packed.buildings.map((building) => building.id).sort(),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const buildings: CityBuilding[] = [];
  const buildingByFile = new Map<string, string>();
  for (const group of groups) {
    const packed = packingByDistrict.get(group.id)!;
    const placed = layoutById.get(group.id) ?? { position: { x: 0, y: 0, z: 0 } };
    for (const packedBuilding of packed.buildings) {
      const file = graph.files.find((candidate) => buildingId(candidate) === packedBuilding.id);
      if (!file) continue;
      const id = packedBuilding.id;
      buildingByFile.set(file.id, id);
      buildings.push({
        id,
        fileId: file.id,
        districtId: group.id,
        name: file.name,
        path: file.path,
        position: {
          x: placed.position.x + packedBuilding.position.x,
          y: packedBuilding.position.y,
          z: placed.position.z + packedBuilding.position.z,
        },
        size: packedBuilding.size,
        complexity: file.complexity,
        loc: file.loc,
        symbolCount: file.symbolIds.length,
        findingIds: findingIdsForFile(graph, file),
      });
    }
  }
  buildings.sort((a, b) => a.id.localeCompare(b.id));

  const edges = [...districtEdges, ...fileEdges(graph, buildingByFile)].sort((a, b) => a.id.localeCompare(b.id));
  const bounds = calculateBounds(districts, buildings);

  return {
    version: CITY_MODEL_VERSION,
    repository: graph.repository,
    districts,
    buildings,
    edges,
    bounds,
    cameraTarget: center(bounds),
  };
}
