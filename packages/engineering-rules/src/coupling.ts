import { makeFindingId, type Finding, type ProjectGraph } from "@codecity/graph-core";

export interface CouplingMetric {
  fanIn: number;
  fanOut: number;
  totalDegree: number;
  percentile: number;
}

function percentileByValue(values: ReadonlyMap<string, number>): Map<string, number> {
  const sorted = [...values.values()].sort((a, b) => a - b);
  const result = new Map<string, number>();
  if (sorted.length === 0) return result;

  for (const [id, value] of values) {
    let upperRank = 0;
    for (const candidate of sorted) {
      if (candidate <= value) upperRank += 1;
    }
    result.set(id, upperRank / sorted.length);
  }
  return result;
}

export function computeCouplingMetrics(graph: ProjectGraph): Map<string, CouplingMetric> {
  const fileIds = new Set(graph.files.map((file) => file.id));
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const id of fileIds) {
    fanIn.set(id, 0);
    fanOut.set(id, 0);
  }

  for (const edge of graph.edges) {
    if (!fileIds.has(edge.source) || !fileIds.has(edge.target)) continue;
    if (edge.kind !== "imports" && edge.kind !== "reexports") continue;
    fanOut.set(edge.source, (fanOut.get(edge.source) ?? 0) + 1);
    fanIn.set(edge.target, (fanIn.get(edge.target) ?? 0) + 1);
  }

  const degree = new Map<string, number>();
  for (const id of fileIds) degree.set(id, (fanIn.get(id) ?? 0) + (fanOut.get(id) ?? 0));
  const percentiles = percentileByValue(degree);
  const result = new Map<string, CouplingMetric>();
  for (const id of [...fileIds].sort()) {
    result.set(id, {
      fanIn: fanIn.get(id) ?? 0,
      fanOut: fanOut.get(id) ?? 0,
      totalDegree: degree.get(id) ?? 0,
      percentile: percentiles.get(id) ?? 0,
    });
  }
  return result;
}

export function findCouplingFindings(graph: ProjectGraph): Finding[] {
  const findings: Finding[] = [];
  for (const [nodeId, metric] of computeCouplingMetrics(graph)) {
    if (metric.percentile < 0.9 || metric.totalDegree === 0) continue;
    findings.push({
      id: makeFindingId("high-coupling", [nodeId]),
      ruleId: "high-coupling",
      title: "High coupling",
      description: "This file sits near the top of the repository-relative dependency distribution.",
      severity: metric.percentile >= 0.98 ? "high" : "medium",
      nodeIds: [nodeId],
      metrics: {
        fanIn: metric.fanIn,
        fanOut: metric.fanOut,
        totalDegree: metric.totalDegree,
        percentile: metric.percentile,
      },
    });
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

export function percentileMap(values: ReadonlyMap<string, number>): Map<string, number> {
  return percentileByValue(values);
}
