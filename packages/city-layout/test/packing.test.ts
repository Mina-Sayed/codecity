import { describe, expect, it } from "vitest";
import { packDistrictBuildings, type PackableBuilding } from "../src/index.js";

const buildings: PackableBuilding[] = [
  { id: "building:a", size: { x: 2, y: 4, z: 2 } },
  { id: "building:b", size: { x: 4, y: 7, z: 3 } },
  { id: "building:c", size: { x: 1.5, y: 3, z: 1.5 } },
];

describe("packDistrictBuildings", () => {
  it("returns the same coordinates for identical input", () => {
    expect(packDistrictBuildings(buildings)).toEqual(packDistrictBuildings(buildings));
  });

  it("keeps footprints separated by the configured margin", () => {
    const packed = packDistrictBuildings(buildings, { margin: 1 });
    for (let left = 0; left < packed.buildings.length; left += 1) {
      for (let right = left + 1; right < packed.buildings.length; right += 1) {
        const a = packed.buildings[left]!;
        const b = packed.buildings[right]!;
        const separatedX = Math.abs(a.position.x - b.position.x) >= (a.size.x + b.size.x) / 2 + 1;
        const separatedZ = Math.abs(a.position.z - b.position.z) >= (a.size.z + b.size.z) / 2 + 1;
        expect(separatedX || separatedZ).toBe(true);
      }
    }
  });

  it("does not reposition existing buildings when a lexically later building is added", () => {
    const before = packDistrictBuildings(buildings);
    const after = packDistrictBuildings([...buildings, { id: "building:z", size: { x: 5, y: 9, z: 5 } }]);

    expect(after.buildings.slice(0, before.buildings.length)).toEqual(before.buildings);
  });
});
