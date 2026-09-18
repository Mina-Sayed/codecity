import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeLocalRepository } from "@codecity/analyzer-js-ts";
import { applyEngineeringRules } from "@codecity/engineering-rules";

interface AnalyzeOptions {
  rootDir: string;
  owner: string;
  repo: string;
  commit: string;
  output: string;
}

function usage(): string {
  return [
    "Usage:",
    "  codecity-analyzer analyze <path> --owner <owner> --repo <repo> --commit <sha> --output <file>",
  ].join("\n");
}

function parseAnalyzeArgs(args: string[]): AnalyzeOptions {
  const [rootDir, ...rest] = args;
  if (!rootDir) throw new Error(`Missing repository path.\n${usage()}`);

  const values = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`Invalid argument sequence near ${key ?? "<end>"}.\n${usage()}`);
    }
    values.set(key, value);
  }

  const owner = values.get("--owner");
  const repo = values.get("--repo");
  const commit = values.get("--commit");
  const output = values.get("--output");
  if (!owner || !repo || !commit || !output) {
    throw new Error(`--owner, --repo, --commit and --output are required.\n${usage()}`);
  }

  return { rootDir, owner, repo, commit, output };
}

async function ensureDirectory(path: string): Promise<void> {
  const info = await stat(path);
  if (!info.isDirectory()) throw new Error(`Repository path is not a directory: ${path}`);
}

export async function runCli(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command !== "analyze") throw new Error(`Unknown command: ${command ?? "<none>"}.\n${usage()}`);

  const options = parseAnalyzeArgs(rest);
  const rootDir = resolve(options.rootDir);
  const output = resolve(options.output);
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
  const enriched = applyEngineeringRules(graph);

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
  return 0;
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
