import type { FileNode, ProjectGraph } from "@codecity/graph-core";
import type { Vec3 } from "./types.js";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function deriveBuildingSize(file: FileNode, graph: ProjectGraph): Vec3 {
  const symbolCount = file.symbolIds.filter((id) => graph.symbols.some((symbol) => symbol.id === id)).length;
  const footprint = clamp(1.4 + Math.log1p(symbolCount) * 0.8, 1.4, 5);
  const height = clamp(
    1.5 + Math.log1p(Math.max(0, file.loc)) * 0.75 + file.complexity.cyclomatic * 0.35 + file.complexity.maxNesting * 0.15,
    1.5,
    20,
  );

  return {
    x: Number(footprint.toFixed(3)),
    y: Number(height.toFixed(3)),
    z: Number(footprint.toFixed(3)),
  };
}
