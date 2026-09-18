import { makeFindingId, type Finding, type ProjectGraph } from "@codecity/graph-core";

export function findCircularDependencies(graph: ProjectGraph): Finding[] {
  const fileIds = new Set(graph.files.map((file) => file.id));
  const adjacency = new Map<string, string[]>();
  const selfEdges = new Set<string>();

  for (const id of fileIds) adjacency.set(id, []);
  for (const edge of graph.edges) {
    if (edge.kind !== "imports" || !fileIds.has(edge.source) || !fileIds.has(edge.target)) continue;
    if (edge.source === edge.target) selfEdges.add(edge.source);
    adjacency.get(edge.source)?.push(edge.target);
  }
  for (const targets of adjacency.values()) targets.sort();

  let nextIndex = 0;
  const indexByNode = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  function strongConnect(node: string): void {
    indexByNode.set(node, nextIndex);
    lowLink.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of adjacency.get(node) ?? []) {
      if (!indexByNode.has(target)) {
        strongConnect(target);
        lowLink.set(node, Math.min(lowLink.get(node)!, lowLink.get(target)!));
      } else if (onStack.has(target)) {
        lowLink.set(node, Math.min(lowLink.get(node)!, indexByNode.get(target)!));
      }
    }

    if (lowLink.get(node) !== indexByNode.get(node)) return;
    const component: string[] = [];
    while (stack.length > 0) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    component.sort();
    components.push(component);
  }

  for (const node of [...fileIds].sort()) {
    if (!indexByNode.has(node)) strongConnect(node);
  }

  return components
    .filter((component) => component.length > 1 || selfEdges.has(component[0]!))
    .map((nodeIds) => ({
      id: makeFindingId("circular-dependency", nodeIds),
      ruleId: "circular-dependency",
      title: "Circular dependency",
      description: `Import cycle contains ${nodeIds.length} file${nodeIds.length === 1 ? "" : "s"}.`,
      severity: "high" as const,
      nodeIds,
      metrics: { files: nodeIds.length },
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
