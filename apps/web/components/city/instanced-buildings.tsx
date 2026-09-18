"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { CityModel } from "@codecity/city-layout";
import { Color, InstancedMesh, Object3D } from "three";
import { useCityStore } from "./city-store";

interface InstancedBuildingsProps {
  model: CityModel;
}

export function InstancedBuildings({ model }: InstancedBuildingsProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const selectedId = useCityStore((state) => state.selectedId);
  const selectBuilding = useCityStore((state) => state.selectBuilding);
  const ordered = useMemo(() => [...model.buildings].sort((a, b) => a.id.localeCompare(b.id)), [model.buildings]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const object = new Object3D();
    const regular = new Color("#4b9bb3");
    const selected = new Color("#5eead4");
    const finding = new Color("#d96b78");

    ordered.forEach((building, index) => {
      object.position.set(building.position.x, building.position.y, building.position.z);
      object.scale.set(building.size.x, building.size.y, building.size.z);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
      mesh.setColorAt(index, building.id === selectedId ? selected : building.findingIds.length ? finding : regular);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ordered, selectedId]);

  function onClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (event.instanceId === undefined) return;
    const building = ordered[event.instanceId];
    if (building) selectBuilding(building.id);
  }

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ordered.length]} onClick={onClick} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.62} metalness={0.12} />
    </instancedMesh>
  );
}
