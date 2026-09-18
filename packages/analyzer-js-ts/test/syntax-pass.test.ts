import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeSyntax, type DiscoveredSourceFile } from "../src/index.js";

const fixturePath = resolve(import.meta.dirname, "../../../fixtures/simple-ts/src/order-service.ts");
const file: DiscoveredSourceFile = { absolutePath: fixturePath, relativePath: "src/order-service.ts", language: "ts" };

describe("analyzeSyntax", () => {
  it("captures imports, re-exports, symbols, calls and complexity", async () => {
    const source = await readFile(fixturePath, "utf8");
    const result = analyzeSyntax(file, source);
    expect(result.imports.some((item) => item.source === "./order-repository.js")).toBe(true);
    expect(result.exports.some((item) => item.source === "./notify.js")).toBe(true);
    expect(result.symbols).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "class", name: "OrderService", exported: true }),
      expect.objectContaining({ kind: "method", name: "place" }),
    ]));
    expect(result.calls.some((call) => call.name === "saveOrder")).toBe(true);
    expect(result.complexity.cyclomatic).toBe(2);
  });
  it("surfaces parser diagnostics rather than throwing for malformed code", () => {
    const result = analyzeSyntax(file, "export function broken( {");
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
