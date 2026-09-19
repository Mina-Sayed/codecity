"use client";

import { Canvas } from "@react-three/fiber";
import type { CityModel } from "@codecity/city-layout";
import { CameraRig } from "./camera-rig";
import { DependencyLines } from "./dependency-lines";
import { DistrictGround } from "./district-ground";
import { InstancedBuildings } from "./instanced-buildings";
import { getCityRenderProfile } from "./render-profile";
import { useCityStore } from "./city-store";

export function CityCanvas({ model }: { model: CityModel }) {
  const clearSelection = useCityStore((state) => state.clearSelection);
  const width = model.bounds.max.x - model.bounds.min.x;
  const depth = model.bounds.max.z - model.bounds.min.z;
  const span = Math.max(width, depth, 20);
  const target = model.cameraTarget;
  const renderProfile = getCityRenderProfile(model.buildings.length);

  return (
    <Canvas
      className="city-canvas"
      shadows={renderProfile.shadows}
      dpr={renderProfile.dpr}
      gl={{ antialias: renderProfile.antialias, powerPreference: "high-performance" }}
      camera={{
        position: [target.x + span * 0.75, Math.max(24, span * 0.65), target.z + span * 0.75],
        fov: 44,
        near: 0.1,
        far: Math.max(1200, span * 20),
      }}
      onPointerMissed={() => clearSelection()}
    >
      <color attach="background" args={["#10232d"]} />
      <fog attach="fog" args={["#10232d", span * 1.5, span * 5]} />
      <ambientLight intensity={1.05} />
      <hemisphereLight args={["#b9e2e3", "#0b1218", 0.9]} />
      <directionalLight
        castShadow={renderProfile.shadows}
        position={[target.x + span, Math.max(30, span), target.z + span * 0.5]}
        intensity={2.6}
      />
      <DistrictGround model={model} receiveShadow={renderProfile.shadows} />
      <DependencyLines model={model} />
      <InstancedBuildings model={model} enableShadows={renderProfile.shadows} />
      <CameraRig model={model} />
    </Canvas>
  );
}
