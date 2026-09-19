import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace layout", () => {
  it("allows grid panels to scroll without expanding the WebGL stage", async () => {
    const styles = await readFile(resolve(import.meta.dirname, "../app/globals.css"), "utf8");
    expect(styles).toContain(".workspace > * { min-height: 0; }");
    expect(styles).toContain("height: 100vh;");
  });
});
