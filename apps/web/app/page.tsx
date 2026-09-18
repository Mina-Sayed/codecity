import { buildCityModel } from "@codecity/city-layout";
import { WorkspaceShell } from "../components/city/workspace-shell";
import { loadDemoGraph } from "../lib/demo-graph";

export default async function HomePage() {
  const graph = await loadDemoGraph();
  const city = await buildCityModel(graph);

  return <WorkspaceShell model={city} findings={graph.findings} />;
}
