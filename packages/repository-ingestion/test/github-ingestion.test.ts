import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as tar from "tar";
import { describe, expect, it } from "vitest";
import {
  GitHubIngestionError,
  analyzePublicGitHubRepository,
  parseGitHubRepositoryUrl,
  resolvePublicGitHubRepository,
} from "../src/index.js";

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
}

function metadataFetch(overrides: { private?: boolean; size?: number } = {}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/branches/")) return jsonResponse({ commit: { sha: "abc123" } });
    if (url.endsWith("/repos/acme/widget")) {
      return jsonResponse({
        private: overrides.private ?? false,
        size: overrides.size ?? 120,
        default_branch: "main",
        archived: false,
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;
}

describe("GitHub repository URL validation", () => {
  it("normalizes standard public repository URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/acme/widget.git")).toEqual({ owner: "acme", name: "widget" });
    expect(parseGitHubRepositoryUrl("https://github.com/acme/widget/")).toEqual({ owner: "acme", name: "widget" });
  });

  it("rejects non-GitHub and nested GitHub URLs", () => {
    expect(() => parseGitHubRepositoryUrl("https://gitlab.com/acme/widget")).toThrowError(GitHubIngestionError);
    expect(() => parseGitHubRepositoryUrl("https://github.com/acme/widget/tree/main")).toThrowError(GitHubIngestionError);
    expect(() => parseGitHubRepositoryUrl("https://github.com/acme/widget?tab=readme")).toThrowError(GitHubIngestionError);
    expect(() => parseGitHubRepositoryUrl("https://github.com/acme/widget#readme")).toThrowError(GitHubIngestionError);
  });
});

describe("GitHub repository metadata", () => {
  it("resolves the immutable default-branch commit", async () => {
    await expect(resolvePublicGitHubRepository(
      { owner: "acme", name: "widget" },
      { fetchImpl: metadataFetch() },
    )).resolves.toMatchObject({
      owner: "acme",
      name: "widget",
      defaultBranch: "main",
      commit: "abc123",
      sizeKb: 120,
    });
  });

  it("rejects private and oversized repositories before downloading source", async () => {
    await expect(resolvePublicGitHubRepository(
      { owner: "acme", name: "widget" },
      { fetchImpl: metadataFetch({ private: true }) },
    )).rejects.toMatchObject({ code: "PRIVATE_REPOSITORY" });

    await expect(resolvePublicGitHubRepository(
      { owner: "acme", name: "widget" },
      { fetchImpl: metadataFetch({ size: 200 }) , limits: { maxRepositorySizeKb: 100 } },
    )).rejects.toMatchObject({ code: "REPOSITORY_TOO_LARGE" });
  });
});

describe("GitHub archive ingestion", () => {
  it("analyzes a downloaded archive without following archived symlinks", async () => {
    const root = await mkdtemp(join(tmpdir(), "codecity-ingestion-test-"));
    try {
      const archiveRoot = join(root, "acme-widget-abc123");
      await mkdir(join(archiveRoot, "src"), { recursive: true });
      await writeFile(join(archiveRoot, "src", "index.ts"), "export const answer = 42;\n", "utf8");
      await writeFile(join(archiveRoot, "package.json"), JSON.stringify({ scripts: { postinstall: "exit 99" } }), "utf8");
      await symlink("/etc/passwd", join(archiveRoot, "src", "outside-link"));

      const archivePath = join(root, "repository.tar.gz");
      await tar.c({ gzip: true, file: archivePath, cwd: root }, ["acme-widget-abc123"]);
      const archive = await readFile(archivePath);
      const stages: string[] = [];

      const fetchImpl = (async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/repos/acme/widget")) {
          return jsonResponse({ private: false, size: 10, default_branch: "main", archived: false });
        }
        if (url.includes("/branches/main")) return jsonResponse({ commit: { sha: "abc123" } });
        if (url.includes("/tarball/abc123")) return new Response(archive, { status: 200 });
        throw new Error(`Unexpected URL: ${url}`);
      }) as typeof fetch;

      const graph = await analyzePublicGitHubRepository("https://github.com/acme/widget", {
        fetchImpl,
        analysisTimestamp: "2026-09-18T00:00:00.000Z",
        onProgress: ({ stage }) => stages.push(stage),
      });

      expect(graph.repository).toEqual({ owner: "acme", name: "widget", commit: "abc123" });
      expect(graph.files.map((file) => file.path)).toContain("src/index.ts");
      expect(graph.files.map((file) => file.path)).not.toContain("src/outside-link");
      expect(stages).toEqual([
        "validating_repository",
        "fetching_metadata",
        "downloading_archive",
        "extracting_archive",
        "analyzing_sources",
        "applying_rules",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("enforces the compressed archive byte limit while streaming", async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/repos/acme/widget")) {
        return jsonResponse({ private: false, size: 10, default_branch: "main", archived: false });
      }
      if (url.includes("/branches/main")) return jsonResponse({ commit: { sha: "abc123" } });
      if (url.includes("/tarball/abc123")) return new Response(new Uint8Array(64), { status: 200 });
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    await expect(analyzePublicGitHubRepository("https://github.com/acme/widget", {
      fetchImpl,
      limits: { maxArchiveBytes: 16 },
    })).rejects.toMatchObject({ code: "ARCHIVE_TOO_LARGE" });
  });
});
