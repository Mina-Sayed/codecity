import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { ProjectGraph } from "@codecity/graph-core";

function normalizeTimestamp(graph: ProjectGraph): ProjectGraph {
  return {
    ...graph,
    analysis: {
      ...graph.analysis,
      timestamp: "<normalized>",
    },
  };
}

describe("analyzer CLI", () => {
  it("writes a deterministic ProjectGraph for a healthy fixture", async () => {
    const repoRoot = resolve(import.meta.dirname, "../../..");
    const outputDir = await mkdtemp(join(tmpdir(), "codecity-cli-"));
    const output = join(outputDir, "simple-ts.project-graph.json");
    const cli = resolve(repoRoot, "apps/analyzer/src/cli.ts");
    const fixture = resolve(repoRoot, "fixtures/simple-ts");

    const child = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        cli,
        "analyze",
        fixture,
        "--owner",
        "codecity",
        "--repo",
        "simple-ts",
        "--commit",
        "fixture",
        "--output",
        output,
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );

    expect(child.status, child.stderr).toBe(0);
    const generated = JSON.parse(await readFile(output, "utf8")) as ProjectGraph;
    const expected = JSON.parse(
      await readFile(resolve(repoRoot, "fixtures/simple-ts/expected.project-graph.json"), "utf8"),
    ) as ProjectGraph;

    expect(generated.schemaVersion).toBe("1.0.0");
    expect(generated.analysis.semanticStatus).toBe("complete");
    expect(Array.isArray(generated.findings)).toBe(true);
    expect(JSON.stringify(generated)).not.toContain("invalid total");
    expect(JSON.stringify(generated)).not.toContain(repoRoot);
    expect(normalizeTimestamp(generated)).toEqual(normalizeTimestamp(expected));
  });
});
