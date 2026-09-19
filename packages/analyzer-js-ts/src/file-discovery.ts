import { lstat, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

export type SourceLanguage = "js" | "jsx" | "ts" | "tsx";

export interface DiscoveredSourceFile {
  absolutePath: string;
  relativePath: string;
  language: SourceLanguage;
}

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  "vendor",
]);

const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;

function toGraphPath(path: string): string {
  return path.split(sep).join("/");
}

function languageForPath(path: string): SourceLanguage | null {
  switch (extname(path).toLowerCase()) {
    case ".js": return "js";
    case ".jsx": return "jsx";
    case ".ts": return "ts";
    case ".tsx": return "tsx";
    default: return null;
  }
}

function isMinified(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".min.js") || lower.endsWith(".min.mjs");
}

export async function discoverSourceFiles(rootDir: string): Promise<DiscoveredSourceFile[]> {
  const root = resolve(rootDir);
  const rootInfo = await stat(root);
  if (!rootInfo.isDirectory()) throw new Error(`Source root is not a directory: ${rootDir}`);
  const discovered: DiscoveredSourceFile[] = [];
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === "." || entry.name === "..") continue;
      const absolutePath = join(directory, entry.name);
      const info = await lstat(absolutePath);
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await walk(absolutePath);
        continue;
      }
      if (!info.isFile() || info.size > MAX_SOURCE_FILE_BYTES) continue;
      if (isMinified(entry.name)) continue;
      const language = languageForPath(entry.name);
      if (language === null) continue;
      const relativePath = toGraphPath(relative(root, absolutePath));
      if (relativePath.startsWith("../") || relativePath === "..") continue;
      discovered.push({ absolutePath, relativePath, language });
    }
  }
  await walk(root);
  discovered.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return discovered;
}
