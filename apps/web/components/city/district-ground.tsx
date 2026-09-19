"use client";

import type { CityModel } from "@codecity/city-layout";

export function DistrictGround({ model }: { model: CityModel }) {
  return (
    <group>
      {model.districts.map((district) => (
        <mesh
          key={district.id}
          position={[district.position.x, district.position.y, district.position.z]}
          receiveShadow
        >
          <boxGeometry args={[district.size.x, district.size.y, district.size.z]} />
          <meshStandardMaterial color="#111d28" roughness={0.9} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}
