"use client";

import type { CityModel } from "@codecity/city-layout";

export function DistrictGround({ model, receiveShadow }: { model: CityModel; receiveShadow: boolean }) {
  return (
    <group>
      {model.districts.map((district) => (
        <mesh
          key={district.id}
          position={[district.position.x, district.position.y, district.position.z]}
          receiveShadow={receiveShadow}
        >
          <boxGeometry args={[district.size.x, district.size.y, district.size.z]} />
          <meshStandardMaterial color="#1a3a44" roughness={0.84} metalness={0.08} />
        </mesh>
      ))}
    </group>
  );
}
