"use client";

import type { CityBuilding, CityModel } from "@codecity/city-layout";
import type { Finding } from "@codecity/graph-core";
import { FindingsPanel } from "./findings-panel";

interface InspectorProps {
  building: CityBuilding | null;
  model: CityModel;
  findings: Finding[];
}

export function Inspector({ building, model, findings }: InspectorProps) {
  return (
    <aside className="panel inspector" aria-label="Building inspector" aria-live="polite">
      <section className="inspector-detail">
        <div className="panel-heading"><span>Inspector</span></div>
        {building ? (
          <div className="inspector-content">
            <div>
              <p className="eyebrow">File building</p>
              <h2>{building.name}</h2>
              <p className="path">{building.path}</p>
            </div>
            <dl className="metrics-grid">
              <div><dt>LOC</dt><dd>{building.loc}</dd></div>
              <div><dt>Complexity</dt><dd>{building.complexity.cyclomatic}</dd></div>
              <div><dt>Nesting</dt><dd>{building.complexity.maxNesting}</dd></div>
              <div><dt>Symbols</dt><dd>{building.symbolCount}</dd></div>
            </dl>
            <section>
              <p className="eyebrow">Engineering findings</p>
              <p className={building.findingIds.length ? "finding-count active" : "finding-count"}>
                {building.findingIds.length ? `${building.findingIds.length} findings` : "No findings"}
              </p>
            </section>
          </div>
        ) : (
          <p className="empty-copy">Select a building from the explorer to inspect the file.</p>
        )}
      </section>
      <FindingsPanel model={model} findings={findings} />
    </aside>
  );
}
