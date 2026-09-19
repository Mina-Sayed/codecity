import type { ProjectGraph } from "@codecity/graph-core";

export function graphWithFiles(names: string[], links: Array<[string, string]>): ProjectGraph {
  const files = names.map((name) => ({
    id: `file:${name}`,
    kind: "file" as const,
    name: `${name}.ts`,
    path: `src/${name}.ts`,
    language: "ts" as const,
    loc: 10,
    complexity: { cyclomatic: 1, maxNesting: 0 },
    symbolIds: [],
    externalImports: [],
    entrypoint: false,
  }));
  return {
    schemaVersion: "1.0.0",
    repository: { owner: "fixture", name: "fixture", commit: "fixture" },
    workspaces: [], districts: [], files, symbols: [],
    edges: links.map(([source, target]) => ({
      id: `imports:${source}:${target}`,
      kind: "imports" as const,
      source: `file:${source}`,
      target: `file:${target}`,
      confidence: "high" as const,
    })),
    metrics: { sourceFiles: files.length, totalLoc: files.length * 10, symbols: 0, edges: links.length, semanticCoverage: 1 },
    findings: [], flows: [],
    analysis: { analyzerVersion: "test", parserVersion: "test", commitSha: "fixture", semanticStatus: "complete", warnings: [], degradedReasons: [], timestamp: "1970-01-01T00:00:00.000Z" },
  };
}
