import type { Finding, ProjectGraph } from "@codecity/graph-core";
import { findCircularDependencies } from "./cycles.js";
import { findCouplingFindings } from "./coupling.js";
import { findHotspotFindings } from "./hotspots.js";

export * from "./cycles.js";
export * from "./coupling.js";
export * from "./hotspots.js";

export function applyEngineeringRules(graph: ProjectGraph): ProjectGraph {
  const findings = new Map<string, Finding>();
  for (const candidate of [
    ...findCircularDependencies(graph),
    ...findCouplingFindings(graph),
    ...findHotspotFindings(graph),
  ]) {
    findings.set(candidate.id, candidate);
  }

  return {
    ...graph,
    findings: [...findings.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
