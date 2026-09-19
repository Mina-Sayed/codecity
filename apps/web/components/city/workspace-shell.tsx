"use client";

import { useMemo } from "react";
import type { CityModel } from "@codecity/city-layout";
import type { Finding } from "@codecity/graph-core";
import { CityCanvas } from "./city-canvas";
import { useCityStore } from "./city-store";
import { Inspector } from "./inspector";
import { ProjectExplorer } from "./project-explorer";

interface WorkspaceShellProps {
  model: CityModel;
  findings: Finding[];
}

export function WorkspaceShell({ model, findings }: WorkspaceShellProps) {
  const selectedId = useCityStore((state) => state.selectedId);
  const selectBuilding = useCityStore((state) => state.selectBuilding);
  const buildingsById = useMemo(
    () => new Map(model.buildings.map((building) => [building.id, building])),
    [model.buildings],
  );
  const selected = useMemo(
    () => (selectedId ? buildingsById.get(selectedId) ?? null : null),
    [buildingsById, selectedId],
  );

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">CC</span><div><strong>CodeCity</strong><span>ARCHITECTURE FIELD ATLAS</span></div></div>
        <div className="repo-identity"><span>ANALYZED REPOSITORY</span><strong>{model.repository.owner}/{model.repository.name}</strong></div>
        <div className="topbar-stats" aria-label="Repository summary">
          <div><span>FILES</span><strong>{model.buildings.length}</strong></div>
          <div><span>DISTRICTS</span><strong>{model.districts.length}</strong></div>
          <div><span>FINDINGS</span><strong>{findings.length}</strong></div>
          <span className="live-pill"><span className="status-dot" /> MAP READY</span>
        </div>
      </header>
      <ProjectExplorer model={model} selectedId={selectedId} onSelect={selectBuilding} />
      <section className="city-stage" aria-label="Interactive code city visualization">
        <CityCanvas model={model} />
        <div className="canvas-hud" aria-live="polite">
          <span>{model.districts.length} districts</span>
          {selected ? <strong>{selected.path}</strong> : <span>No building selected</span>}
        </div>
      </section>
      <Inspector building={selected} model={model} findings={findings} />
      <footer className="statusbar">
        <span><b>PROJECTGRAPH</b> → CITYMODEL v{model.version}</span>
        <span>MAP BOUNDS {Math.round(model.bounds.max.x - model.bounds.min.x)} × {Math.round(model.bounds.max.z - model.bounds.min.z)}</span>
      </footer>
    </main>
  );
}
