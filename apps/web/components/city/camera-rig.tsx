"use client";

import { useEffect, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { CityModel } from "@codecity/city-layout";
import { Vector3 } from "three";
import { useCityStore } from "./city-store";

export function CameraRig({ model }: { model: CityModel }) {
  const camera = useThree((state) => state.camera);
  const controlsRef = useRef<any>(null);
  const selectedId = useCityStore((state) => state.selectedId);
  const focusVersion = useCityStore((state) => state.focusVersion);
  const [reducedMotion, setReducedMotion] = useState(false);
  const desiredTarget = useRef(new Vector3(model.cameraTarget.x, model.cameraTarget.y, model.cameraTarget.z));
  const desiredCamera = useRef(camera.position.clone());
  const animating = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const building = model.buildings.find((candidate) => candidate.id === selectedId);
    if (!building) return;
    const span = Math.max(building.size.y * 2.8, 12);
    desiredTarget.current.set(building.position.x, building.size.y * 0.45, building.position.z);
    desiredCamera.current.set(building.position.x + span, building.position.y + span * 0.8, building.position.z + span);

    if (reducedMotion) {
      camera.position.copy(desiredCamera.current);
      controlsRef.current?.target.copy(desiredTarget.current);
      controlsRef.current?.update();
      animating.current = false;
    } else {
      animating.current = true;
    }
  }, [camera, focusVersion, model.buildings, reducedMotion, selectedId]);

  useFrame(() => {
    if (!animating.current || !controlsRef.current) return;
    camera.position.lerp(desiredCamera.current, 0.11);
    controlsRef.current.target.lerp(desiredTarget.current, 0.14);
    controlsRef.current.update();
    if (camera.position.distanceTo(desiredCamera.current) < 0.08 && controlsRef.current.target.distanceTo(desiredTarget.current) < 0.08) {
      camera.position.copy(desiredCamera.current);
      controlsRef.current.target.copy(desiredTarget.current);
      animating.current = false;
    }
  });

  const width = model.bounds.max.x - model.bounds.min.x;
  const depth = model.bounds.max.z - model.bounds.min.z;
  const maxDistance = Math.max(80, Math.max(width, depth) * 4);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={maxDistance}
      minPolarAngle={0.18}
      maxPolarAngle={Math.PI / 2.08}
      target={[model.cameraTarget.x, model.cameraTarget.y, model.cameraTarget.z]}
    />
  );
}
