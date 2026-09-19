import { describe, expect, it } from "vitest";
import { getCityRenderProfile } from "../components/city/render-profile";

describe("city render profile", () => {
  it("keeps full visual quality for small repositories", () => {
    expect(getCityRenderProfile(80)).toEqual({
      shadows: true,
      dpr: [1, 1.75],
      antialias: true,
    });
  });

  it("protects WebGL on larger repositories", () => {
    expect(getCityRenderProfile(300)).toEqual({
      shadows: false,
      dpr: [1, 1.25],
      antialias: false,
    });
  });
});
