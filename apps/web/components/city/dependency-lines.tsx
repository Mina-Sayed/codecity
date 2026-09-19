"use client";

import { Line } from "@react-three/drei";
import type { CityModel, Vec3 } from "@codecity/city-layout";
import { useCityStore } from "./city-store";

function point(position: Vec3, lift = 0): [number, number, number] {
  return [position.x, position.y + lift, position.z];
}

export function DependencyLines({ model }: { model: CityModel }) {
  const selectedId = useCityStore((state) => state.selectedId);
  const districts = new Map(model.districts.map((district) => [district.id, district]));
  const buildings = new Map(model.buildings.map((building) => [building.id, building]));
  const edges = model.edges.filter((edge) =>
    edge.level === "district" || (edge.level === "file" && selectedId !== null && (edge.sourceId === selectedId || edge.targetId === selectedId)),
  );

  return (
    <group>
      {edges.map((edge) => {
        const source = edge.level === "district" ? districts.get(edge.sourceId) : buildings.get(edge.sourceId);
        const target = edge.level === "district" ? districts.get(edge.targetId) : buildings.get(edge.targetId);
        if (!source || !target) return null;
        const lift = edge.level === "file" ? 1 : 0.8;
        return (
          <Line
            key={edge.id}
            points={[point(source.position, lift), point(target.position, lift)]}
            color={edge.level === "file" ? "#8ff1d0" : "#8ac7ff"}
            lineWidth={edge.level === "file" ? 2.2 : Math.min(3.5, 1 + edge.weight * 0.45)}
            transparent
            opacity={edge.level === "file" ? 0.9 : 0.46}
          />
        );
      })}
    </group>
  );
}
