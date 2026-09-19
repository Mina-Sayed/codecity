import type { ProjectGraph } from "@codecity/graph-core";

export const CITY_MODEL_VERSION = "1.0.0" as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CityBounds {
  min: Vec3;
  max: Vec3;
}

export interface CityBuilding {
  id: string;
  fileId: string;
  districtId: string;
  name: string;
  path: string;
  position: Vec3;
  size: Vec3;
  complexity: {
    cyclomatic: number;
    maxNesting: number;
  };
  loc: number;
  symbolCount: number;
  findingIds: string[];
}

export interface CityDistrict {
  id: string;
  name: string;
  path: string;
  position: Vec3;
  size: Vec3;
  buildingIds: string[];
}

export interface CityEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  level: "district" | "file";
}

export interface CityModel {
  version: typeof CITY_MODEL_VERSION;
  repository: ProjectGraph["repository"];
  districts: CityDistrict[];
  buildings: CityBuilding[];
  edges: CityEdge[];
  bounds: CityBounds;
  cameraTarget: Vec3;
}
