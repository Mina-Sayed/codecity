"use client";

import { useMemo } from "react";
import type { CityModel } from "@codecity/city-layout";
import { CitySearch } from "./search";

interface ProjectExplorerProps {
  model: CityModel;
  selectedId: string | null;
  onSelect: (buildingId: string) => void;
}

export function ProjectExplorer({ model, selectedId, onSelect }: ProjectExplorerProps) {
  const buildingsById = useMemo(
    () => new Map(model.buildings.map((building) => [building.id, building])),
    [model.buildings],
  );

  return (
    <nav className="panel explorer" aria-label="Project explorer">
      <div className="panel-heading">
        <div><span className="panel-kicker">01 / STRUCTURE</span><strong>Project explorer</strong></div>
        <span className="count-badge">{model.buildings.length}</span>
      </div>
      <CitySearch model={model} />
      <div className="district-list">
        {model.districts.map((district) => (
          <section className="district-group" key={district.id} aria-labelledby={`district-${district.id}`}>
            <h2 id={`district-${district.id}`}>{district.path}</h2>
            <ul>
              {district.buildingIds.map((buildingId) => {
                const building = buildingsById.get(buildingId);
                if (!building) return null;
                return (
                  <li key={building.id}>
                    <button
                      type="button"
                      className={selectedId === building.id ? "file-button selected" : "file-button"}
                      onClick={() => onSelect(building.id)}
                      aria-pressed={selectedId === building.id}
                    >
                      <span>{building.name}</span>
                      <small>{building.loc} LOC</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
