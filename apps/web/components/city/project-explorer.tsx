"use client";

import type { CityModel } from "@codecity/city-layout";
import { CitySearch } from "./search";

interface ProjectExplorerProps {
  model: CityModel;
  selectedId: string | null;
  onSelect: (buildingId: string) => void;
}

export function ProjectExplorer({ model, selectedId, onSelect }: ProjectExplorerProps) {
  return (
    <nav className="panel explorer" aria-label="Project explorer">
      <div className="panel-heading">
        <span>Project</span>
        <strong>{model.buildings.length}</strong>
      </div>
      <CitySearch model={model} />
      <div className="district-list">
        {model.districts.map((district) => (
          <section className="district-group" key={district.id} aria-labelledby={`district-${district.id}`}>
            <h2 id={`district-${district.id}`}>{district.path}</h2>
            <ul>
              {district.buildingIds.map((buildingId) => {
                const building = model.buildings.find((candidate) => candidate.id === buildingId);
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
