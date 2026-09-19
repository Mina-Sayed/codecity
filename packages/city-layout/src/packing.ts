import type { Vec3 } from "./types.js";

export interface PackableBuilding {
  id: string;
  size: Vec3;
}

export interface PackedBuilding extends PackableBuilding {
  position: Vec3;
}

export interface PackedDistrict {
  buildings: PackedBuilding[];
  size: Vec3;
}

export interface PackingOptions {
  margin?: number;
  columns?: number;
  maxFootprint?: number;
  groundHeight?: number;
}

export function packDistrictBuildings(
  input: readonly PackableBuilding[],
  options: PackingOptions = {},
): PackedDistrict {
  const margin = options.margin ?? 1;
  const columns = Math.max(1, Math.floor(options.columns ?? 8));
  const maxFootprint = Math.max(1, options.maxFootprint ?? 5);
  const groundHeight = Math.max(0, options.groundHeight ?? 0.5);
  const stride = maxFootprint + margin * 2;
  const ordered = [...input].sort((a, b) => a.id.localeCompare(b.id));

  const buildings = ordered.map((building, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      ...building,
      position: {
        x: column * stride + stride / 2,
        y: groundHeight + building.size.y / 2,
        z: row * stride + stride / 2,
      },
    };
  });

  const usedColumns = Math.min(columns, Math.max(1, ordered.length));
  const usedRows = Math.max(1, Math.ceil(ordered.length / columns));

  return {
    buildings,
    size: {
      x: usedColumns * stride,
      y: groundHeight,
      z: usedRows * stride,
    },
  };
}
