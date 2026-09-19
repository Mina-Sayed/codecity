"use client";

import { useMemo, useState } from "react";
import type { CityModel } from "@codecity/city-layout";
import { useCityStore } from "./city-store";

export function CitySearch({ model }: { model: CityModel }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selectBuilding = useCityStore((state) => state.selectBuilding);
  const normalized = query.trim().toLowerCase();
  const matches = useMemo(
    () => normalized
      ? model.buildings
          .filter((building) => building.name.toLowerCase().includes(normalized) || building.path.toLowerCase().includes(normalized))
          .sort((a, b) => a.path.localeCompare(b.path))
          .slice(0, 8)
      : [],
    [model.buildings, normalized],
  );

  function choose(index: number) {
    const building = matches[index];
    if (!building) return;
    selectBuilding(building.id);
    setQuery("");
    setActiveIndex(0);
  }

  return (
    <div className="city-search">
      <label htmlFor="city-search-input">Search files</label>
      <div className="search-field">
        <input
          id="city-search-input"
          value={query}
          placeholder="Find file or path…"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (!matches.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % matches.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(activeIndex);
            } else if (event.key === "Escape") {
              setQuery("");
              setActiveIndex(0);
            }
          }}
          aria-controls="city-search-results"
          aria-expanded={matches.length > 0}
        />
        {query ? <button className="search-clear" type="button" aria-label="Clear file search" onClick={() => { setQuery(""); setActiveIndex(0); }}>×</button> : null}
      </div>
      {matches.length ? (
        <ul id="city-search-results" className="search-results" aria-label="Search results">
          {matches.map((building, index) => (
            <li key={building.id}>
              <button
                type="button"
                className={index === activeIndex ? "search-result active" : "search-result"}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <strong>{building.name}</strong>
                <small>{building.path}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
