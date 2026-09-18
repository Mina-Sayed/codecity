import { posix } from "node:path";
import { makeFindingId, type FileNode, type Finding, type ProjectGraph } from "@codecity/graph-core";
import { computeCouplingMetrics, percentileMap } from "./coupling.js";

function severity(percentile: number): "high" | "medium" {
  return percentile >= 0.98 ? "high" : "medium";
}

function finding(
  ruleId: string,
  title: string,
  description: string,
  file: FileNode,
  percentile: number,
  metrics: Record<string, number>,
): Finding {
  return {
    id: makeFindingId(ruleId, [file.id]),
    ruleId,
    title,
    description,
    severity: severity(percentile),
    nodeIds: [file.id],
    metrics: { ...metrics, percentile },
  };
}

function isConventionalEntrypoint(file: FileNode): boolean {
  if (file.entrypoint) return true;
  const base = posix.basename(file.path).toLowerCase();
  if (/^(?:vite|next|eslint|webpack|rollup|vitest|jest)\.config\.(?:js|jsx|ts|tsx)$/.test(base)) return true;
  if (/^(?:route|page|layout|middleware)\.(?:js|jsx|ts|tsx)$/.test(base)) return true;
  if (/(^|\/)(?:test|tests|__tests__|fixtures)(\/|$)/.test(file.path)) return true;
  if (/\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/.test(base)) return true;
  return false;
}

export function findHotspotFindings(graph: ProjectGraph): Finding[] {
  const complexityValues = new Map(graph.files.map((file) => [file.id, file.complexity.cyclomatic]));
  const locValues = new Map(graph.files.map((file) => [file.id, file.loc]));
  const symbolValues = new Map(graph.files.map((file) => [file.id, file.symbolIds.length]));
  const complexityPercentiles = percentileMap(complexityValues);
  const locPercentiles = percentileMap(locValues);
  const symbolPercentiles = percentileMap(symbolValues);
  const coupling = computeCouplingMetrics(graph);
  const incoming = new Map(graph.files.map((file) => [file.id, 0]));

  for (const edge of graph.edges) {
    if (incoming.has(edge.target) && edge.source !== edge.target) {
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    }
  }

  const findings: Finding[] = [];
  for (const file of graph.files) {
    const complexityPercentile = complexityPercentiles.get(file.id) ?? 0;
    if (complexityPercentile >= 0.9 && file.complexity.cyclomatic > 1) {
      findings.push(
        finding(
          "complexity-hotspot",
          "Complexity hotspot",
          "Cyclomatic complexity is high relative to other files in this repository.",
          file,
          complexityPercentile,
          { cyclomatic: file.complexity.cyclomatic, maxNesting: file.complexity.maxNesting },
        ),
      );
    }

    const sizePercentile = Math.max(locPercentiles.get(file.id) ?? 0, symbolPercentiles.get(file.id) ?? 0);
    if (sizePercentile >= 0.9 && (file.loc > 0 || file.symbolIds.length > 0)) {
      findings.push(
        finding(
          "large-module",
          "Large module",
          "This file is unusually large relative to the repository by LOC or symbol count.",
          file,
          sizePercentile,
          { loc: file.loc, symbols: file.symbolIds.length },
        ),
      );
    }

    const couplingMetric = coupling.get(file.id);
    if (couplingMetric && couplingMetric.percentile >= 0.9 && couplingMetric.totalDegree > 0) {
      findings.push(
        finding(
          "dependency-hub",
          "Dependency hub",
          "This file has high normalized degree centrality relative to the repository.",
          file,
          couplingMetric.percentile,
          { totalDegree: couplingMetric.totalDegree },
        ),
      );
    }

    if ((incoming.get(file.id) ?? 0) === 0 && !isConventionalEntrypoint(file)) {
      findings.push({
        id: makeFindingId("possible-unused-file", [file.id]),
        ruleId: "possible-unused-file",
        title: "Possible unused file",
        description: "No incoming internal graph edges were found. Dynamic or convention-based usage may still exist.",
        severity: "info",
        nodeIds: [file.id],
        metrics: { incomingInternalEdges: 0 },
      });
    }
  }

  return findings.sort((a, b) => a.id.localeCompare(b.id));
}
