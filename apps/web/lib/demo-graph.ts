import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ProjectGraph } from "@codecity/graph-core";

export async function loadDemoGraph(): Promise<ProjectGraph> {
  const path = resolve(process.cwd(), "../../fixtures/simple-ts/expected.project-graph.json");
  return JSON.parse(await readFile(path, "utf8")) as ProjectGraph;
}
