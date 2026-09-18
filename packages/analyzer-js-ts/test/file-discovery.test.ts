import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSourceFiles } from "../src/index.js";

const fixture = (name: string) => resolve(import.meta.dirname, "../../../fixtures", name);

describe("discoverSourceFiles", () => {
  it("returns only supported source files in stable path order", async () => {
    const files = await discoverSourceFiles(fixture("mixed-js-ts"));
    expect(files.map((file) => file.relativePath)).toEqual([
      "src/index.ts",
      "src/legacy.js",
      "src/view.tsx",
      "src/widget.jsx",
    ]);
  });

  it("ignores symlinks that could escape the repository root", async () => {
    const root = await mkdtemp(join(tmpdir(), "codecity-root-"));
    const outside = await mkdtemp(join(tmpdir(), "codecity-outside-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.ts"), "export const ok = true;\n");
    await writeFile(join(outside, "secret.ts"), "export const secret = true;\n");
    await symlink(join(outside, "secret.ts"), join(root, "src", "outside.ts"));
    const files = await discoverSourceFiles(root);
    expect(files.map((file) => file.relativePath)).toEqual(["src/index.ts"]);
  });
});
