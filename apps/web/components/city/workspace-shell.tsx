"use client";

import { useEffect, useMemo } from "react";
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

  useEffect(() => {
    if (!selectedId && model.buildings[0]) selectBuilding(model.buildings[0].id);
  }, [model.buildings, selectBuilding, selectedId]);

  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">CC</span><strong>CodeCity</strong></div>
        <div className="repo-meta">
          <span>{model.repository.owner}/{model.repository.name}</span>
          <span>{model.buildings.length} files</span>
          <span>{findings.length} findings</span>
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
        <span>ProjectGraph → CityModel v{model.version}</span>
        <span>Bounds {Math.round(model.bounds.max.x - model.bounds.min.x)} × {Math.round(model.bounds.max.z - model.bounds.min.z)}</span>
      </footer>
    </main>
  );
}
