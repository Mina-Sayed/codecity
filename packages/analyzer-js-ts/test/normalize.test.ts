import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeLocalRepository } from "../src/index.js";

const input = {
  rootDir: resolve(import.meta.dirname, "../../../fixtures/simple-ts"),
  repository: { owner: "codecity", name: "simple-ts", commit: "fixture" },
};

describe("analyzeLocalRepository", () => {
  it("normalizes analysis into a deterministic V1 ProjectGraph", async () => {
    const graph = await analyzeLocalRepository(input);
    expect(graph.schemaVersion).toBe("1.0.0");
    expect(graph.analysis.semanticStatus).toBe("complete");
    expect(graph.files.every((file) => file.id.startsWith("file:")).toBe(true);
    expect(graph.files.map((file) => file.id)).toEqual([...graph.files.map((file) => file.id)].sort());
    expect(graph.edges.map((edge) => edge.id)).toEqual([...graph.edges.map((edge) => edge.id)].sort());
    expect(graph.edges.some((edge) => edge.kind === "imports")).toBe(true);
    expect(graph.symbols.some((symbol) => symbol.name === "AppService")).toBe(true);
    expect(graph.files.some((file) => file.path.includes("node_modules"))).toBe(false);
  });
  it("returns deep-equal output for the same repository input", async () => {
    expect(await analyzeLocalRepository(input)).toEqual(await analyzeLocalRepository(input));
  });
});
