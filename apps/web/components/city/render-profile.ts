export interface CityRenderProfile {
  shadows: boolean;
  dpr: [number, number];
  antialias: boolean;
}

export function getCityRenderProfile(buildingCount: number): CityRenderProfile {
  const largeCity = buildingCount > 180;
  return largeCity
    ? { shadows: false, dpr: [1, 1.25], antialias: false }
    : { shadows: true, dpr: [1, 1.75], antialias: true };
}
