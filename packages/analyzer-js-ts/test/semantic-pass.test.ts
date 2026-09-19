import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeSemantics, analyzeSemanticsWithTypeScript, analyzeSyntax, discoverSourceFiles } from "../src/index.js";

async function syntaxFor(rootDir: string) {
  const files = await discoverSourceFiles(rootDir);
  return Promise.all(files.map(async (file) => analyzeSyntax(file, await readFile(file.absolutePath, "utf8"))));
}

describe("analyzeSemantics", () => {
  it("resolves path aliases, inheritance and re-exports", async () => {
    const root = resolve(import.meta.dirname, "../../../fixtures/simple-ts");
    const result = await analyzeSemantics(root, await syntaxFor(root));
    expect(result.status).toBe("complete");
    expect(result.resolvedImports).toEqual(expect.arrayContaining([expect.objectContaining({ sourcePath: "src/app-service.ts", specifier: "@shared/base-service", targetPath: "src/shared/base-service.ts" })]));
    expect(result.relations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "extends", sourcePath: "src/app-service.ts", sourceSymbol: "AppService", targetPath: "src/shared/base-service.ts", targetSymbol: "BaseService" }),
      expect.objectContaining({ kind: "reexports", sourcePath: "src/index.ts", targetPath: "src/app-service.ts" }),
    ]));
  });
  it("degrades instead of throwing when tsconfig is invalid", async () => {
    const root = resolve(import.meta.dirname, "../../../fixtures/broken-tsconfig");
    const result = await analyzeSemantics(root, await syntaxFor(root));
    expect(result.status).toBe("degraded");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("provides a TypeScript-only semantic pass for the web analyzer", async () => {
    const root = resolve(import.meta.dirname, "../../../fixtures/simple-ts");
    const result = await analyzeSemanticsWithTypeScript(root, await syntaxFor(root));
    expect(result.resolvedImports).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePath: "src/app-service.ts", targetPath: "src/shared/base-service.ts" }),
    ]));
  });
});
