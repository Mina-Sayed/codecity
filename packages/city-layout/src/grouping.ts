import { posix } from "node:path";
import { makeNodeId, normalizeGraphPath, type ProjectGraph } from "@codecity/graph-core";

export interface DistrictGroup {
  id: string;
  name: string;
  path: string;
  fileIds: string[];
}

function folderOf(filePath: string): string {
  const normalized = normalizeGraphPath(filePath);
  const directory = posix.dirname(normalized);
  return directory === "." ? "." : directory;
}

export function groupFilesIntoDistricts(graph: ProjectGraph): DistrictGroup[] {
  const byPath = new Map<string, string[]>();

  for (const file of graph.files) {
    const path = folderOf(file.path);
    const fileIds = byPath.get(path) ?? [];
    fileIds.push(file.id);
    byPath.set(path, fileIds);
  }

  return [...byPath.entries()]
    .map(([path, fileIds]) => ({
      id: makeNodeId("city-district", path),
      name: path === "." ? "(root)" : posix.basename(path),
      path,
      fileIds: [...fileIds].sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
