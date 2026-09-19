import { describe, expect, it } from "vitest";
import {
  CITY_MODEL_VERSION,
  type CityBuilding,
  type CityDistrict,
  type CityEdge,
  type CityModel,
} from "../src/index.js";

const district: CityDistrict = {
  id: "district:src",
  name: "src",
  path: "src",
  position: { x: 0, y: 0, z: 0 },
  size: { x: 20, y: 0.5, z: 20 },
  buildingIds: ["building:file:one"],
};

const building: CityBuilding = {
  id: "building:file:one",
  fileId: "file:one",
  districtId: district.id,
  name: "one.ts",
  path: "src/one.ts",
  position: { x: 0, y: 2, z: 0 },
  size: { x: 2, y: 4, z: 2 },
  complexity: { cyclomatic: 3, maxNesting: 1 },
  loc: 80,
  symbolCount: 4,
  findingIds: [],
};

const edge: CityEdge = {
  id: "city-edge:district:src:district:shared",
  sourceId: district.id,
  targetId: "district:shared",
  weight: 2,
  level: "district",
};

describe("CityModel contract", () => {
  it("exposes the V1 model version and typed city primitives", () => {
    const model: CityModel = {
      version: CITY_MODEL_VERSION,
      repository: { owner: "codecity", name: "fixture", commit: "abc123" },
      districts: [district],
      buildings: [building],
      edges: [edge],
      bounds: {
        min: { x: -10, y: 0, z: -10 },
        max: { x: 10, y: 4, z: 10 },
      },
      cameraTarget: { x: 0, y: 2, z: 0 },
    };

    expect(CITY_MODEL_VERSION).toBe("1.0.0");
    expect(model.buildings[0]?.fileId).toBe("file:one");
    expect(model.edges[0]?.level).toBe("district");
  });
});
