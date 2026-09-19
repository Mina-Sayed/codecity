import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeLocalRepository } from "@codecity/analyzer-js-ts";
import { applyEngineeringRules } from "@codecity/engineering-rules";
import type { ProjectGraph } from "@codecity/graph-core";
import { analyzePublicGitHubRepository } from "./github-ingestion.js";

interface AnalyzeOptions {
  rootDir: string;
  owner: string;
  repo: string;
  commit: string;
  output: string;
}

interface AnalyzeGitHubOptions {
  repositoryUrl: string;
  output: string;
}

function usage(): string {
  return [
    "Usage:",
    "  codecity-analyzer analyze <path> --owner <owner> --repo <repo> --commit <sha> --output <file>",
    "  codecity-analyzer analyze-github <https://github.com/owner/repository> --output <file>",
    "",
    "Optional environment variables:",
    "  GITHUB_TOKEN  Raises GitHub API rate limits for public repository analysis.",
  ].join("\n");
}

function parseFlags(rest: string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Invalid argument sequence near ${key ?? "<end>"}.\n${usage()}`);
    }
    values.set(key, value);
  }
  return values;
}

function parseAnalyzeArgs(args: string[]): AnalyzeOptions {
  const [rootDir, ...rest] = args;
  if (!rootDir) throw new Error(`Missing repository path.\n${usage()}`);

  const values = parseFlags(rest);
  const owner = values.get("--owner");
  const repo = values.get("--repo");
  const commit = values.get("--commit");
  const output = values.get("--output");
  if (!owner || !repo || !commit || !output) {
    throw new Error(`--owner, --repo, --commit and --output are required.\n${usage()}`);
  }

  return { rootDir, owner, repo, commit, output };
}

function parseAnalyzeGitHubArgs(args: string[]): AnalyzeGitHubOptions {
  const [repositoryUrl, ...rest] = args;
  if (!repositoryUrl) throw new Error(`Missing GitHub repository URL.\n${usage()}`);
  const output = parseFlags(rest).get("--output");
  if (!output) throw new Error(`--output is required.\n${usage()}`);
  return { repositoryUrl, output };
}

async function ensureDirectory(path: string): Promise<void> {
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`Repository path is not a directory: ${path}`);
}

async function writeGraph(outputPath: string, graph: ProjectGraph): Promise<void> {
  const output = resolve(outputPath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
}

async function analyzeLocal(options: AnalyzeOptions): Promise<ProjectGraph> {
  const rootDir = resolve(options.rootDir);
  await ensureDirectory(rootDir);
  const graph = await analyzeLocalRepository({
    rootDir,
    repository: {
      owner: options.owner,
      name: options.repo,
      commit: options.commit,
    },
    analysisTimestamp: new Date().toISOString(),
  });
  return applyEngineeringRules(graph);
}

export async function runCli(args: string[]): Promise<number> {
  const [command, ...rest] = args;

  if (command === "analyze") {
    const options = parseAnalyzeArgs(rest);
    await writeGraph(options.output, await analyzeLocal(options));
    return 0;
  }

  if (command === "analyze-github") {
    const options = parseAnalyzeGitHubArgs(rest);
    const token = process.env.GITHUB_TOKEN;
    const graph = await analyzePublicGitHubRepository(options.repositoryUrl, {
      ...(token ? { token } : {}),
      onProgress: ({ message }) => console.error(`[codecity] ${message}`),
    });
    await writeGraph(options.output, graph);
    return 0;
  }

  throw new Error(`Unknown command: ${command ?? "<none>"}.\n${usage()}`);
}

const directEntry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (directEntry === import.meta.url) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
