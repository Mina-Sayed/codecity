import { createRequire } from "node:module";
import type { CityEdge, Vec3 } from "./types.js";

const require = createRequire(import.meta.url);

export interface DistrictLayoutNode {
  id: string;
  width: number;
  depth: number;
}

export interface LaidOutDistrict extends DistrictLayoutNode {
  position: Vec3;
}

type ElkConstructor = new () => {
  layout(graph: unknown): Promise<{
    children?: Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>;
  }>;
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function fallbackLayout(nodes: readonly DistrictLayoutNode[]): LaidOutDistrict[] {
  const ordered = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  let cursor = 0;
  return ordered.map((node) => {
    const position = { x: round(cursor), y: 0, z: 0 };
    cursor += node.width + 20;
    return { ...node, position };
  });
}

function loadElk(): ElkConstructor | null {
  try {
    const loaded = require("elkjs/lib/elk.bundled.js") as { default?: ElkConstructor } | ElkConstructor;
    return typeof loaded === "function" ? loaded : loaded.default ?? null;
  } catch {
    return null;
  }
}

export async function layoutDistricts(
  input: readonly DistrictLayoutNode[],
  edges: readonly CityEdge[],
): Promise<LaidOutDistrict[]> {
  const nodes = [...input].sort((a, b) => a.id.localeCompare(b.id));
  if (nodes.length === 0) return [];

  const ELK = loadElk();
  if (!ELK) return fallbackLayout(nodes);

  const elk = new ELK();
  const result = await elk.layout({
    id: "codecity",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "40",
      "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: nodes.map((node) => ({ id: node.id, width: node.width, height: node.depth })),
    edges: [...edges]
      .filter((edge) => edge.level === "district")
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((edge) => ({ id: edge.id, sources: [edge.sourceId], targets: [edge.targetId] })),
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const output = (result.children ?? []).flatMap((child) => {
    const source = byId.get(child.id);
    if (!source) return [];
    return [{
      ...source,
      position: {
        x: round(child.x ?? 0),
        y: 0,
        z: round(child.y ?? 0),
      },
    }];
  });

  return output.length === nodes.length ? output.sort((a, b) => a.id.localeCompare(b.id)) : fallbackLayout(nodes);
}
