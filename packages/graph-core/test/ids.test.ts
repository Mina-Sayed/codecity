import { describe, expect, it } from "vitest";
import { makeEdgeId, makeFindingId, makeNodeId, normalizeGraphPath } from "../src/index.js";

describe("deterministic ids", () => {
  it("returns the same file id for equivalent normalized paths", () => {
    expect(makeNodeId("file", "src\\auth\\index.ts")).toBe(
      makeNodeId("file", "./src/auth/index.ts"),
    );
  });

  it("changes a symbol id when the symbol changes", () => {
    expect(makeNodeId("function", "src/a.ts", "login")).not.toBe(
      makeNodeId("function", "src/a.ts", "logout"),
    );
  });

  it("makes edge direction significant", () => {
    expect(makeEdgeId("imports", "a", "b")).not.toBe(
      makeEdgeId("imports", "b", "a"),
    );
  });

  it("normalizes redundant path segments", () => {
    expect(normalizeGraphPath("./src/a/../b.ts")).toBe("src/b.ts");
  });

  it("makes finding ids independent from input node order", () => {
    expect(makeFindingId("cycles", ["b", "a"])).toBe(makeFindingId("cycles", ["a", "b"]));
  });
});
