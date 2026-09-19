"use client";

import { useMemo } from "react";
import type { CityModel } from "@codecity/city-layout";
import type { Finding } from "@codecity/graph-core";
import { useCityStore } from "./city-store";

export function FindingsPanel({ model, findings }: { model: CityModel; findings: Finding[] }) {
  const selectBuilding = useCityStore((state) => state.selectBuilding);
  const buildingByFindingId = useMemo(() => {
    const index = new Map<string, CityModel["buildings"][number]>();
    for (const building of model.buildings) {
      for (const findingId of building.findingIds) index.set(findingId, building);
    }
    return index;
  }, [model.buildings]);

  return (
    <section className="findings-panel" aria-labelledby="findings-heading">
      <div className="panel-heading">
        <div><span className="panel-kicker">04 / SIGNALS</span><strong id="findings-heading">Engineering findings</strong></div>
        <span className="count-badge count-badge-warning">{findings.length}</span>
      </div>
      <ul className="finding-list">
        {findings.map((finding) => {
          const building = buildingByFindingId.get(finding.id);
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
