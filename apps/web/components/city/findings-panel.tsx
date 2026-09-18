"use client";

import type { CityModel } from "@codecity/city-layout";
import type { Finding } from "@codecity/graph-core";
import { useCityStore } from "./city-store";

export function FindingsPanel({ model, findings }: { model: CityModel; findings: Finding[] }) {
  const selectBuilding = useCityStore((state) => state.selectBuilding);

  return (
    <section className="findings-panel" aria-labelledby="findings-heading">
      <div className="panel-heading">
        <span id="findings-heading">Engineering findings</span>
        <strong>{findings.length}</strong>
      </div>
      <ul className="finding-list">
        {findings.map((finding) => {
          const building = model.buildings.find((candidate) => candidate.findingIds.includes(finding.id));
          return (
            <li key={finding.id}>
              <button
                type="button"
                className="finding-button"
                disabled={!building}
                onClick={() => building && selectBuilding(building.id)}
              >
                <span className={`severity severity-${finding.severity}`}>{finding.severity}</span>
                <strong>{finding.title}</strong>
                <small>{finding.ruleId}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
