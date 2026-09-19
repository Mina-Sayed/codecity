import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeLocalRepository } from "../src/web.js";

const fixtureRoot = resolve(import.meta.dirname, "../../../fixtures/simple-ts");

it("analyzes with the web-safe TypeScript syntax engine", async () => {
  const graph = await analyzeLocalRepository({
    rootDir: fixtureRoot,
    repository: { owner: "codecity", name: "simple-ts", commit: "fixture" },
    analysisTimestamp: "2026-09-18T00:00:00.000Z",
  });

  expect(graph.analysis.parserVersion).toBe("typescript");
  expect(graph.files.length).toBeGreaterThan(0);
  expect(graph.symbols.length).toBeGreaterThan(0);
});
