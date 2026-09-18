import { mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as tar from "tar";
import { applyEngineeringRules } from "@codecity/engineering-rules";
import type { ProjectGraph } from "@codecity/graph-core";
import type { AnalyzeLocalRepositoryInput } from "@codecity/analyzer-js-ts";

export interface GitHubRepositoryRef {
  owner: string;
  name: string;
}

export interface GitHubRepositoryMetadata extends GitHubRepositoryRef {
  defaultBranch: string;
  commit: string;
  sizeKb: number;
  archived: boolean;
}

export type GitHubAnalysisStage =
  | "validating_repository"
  | "fetching_metadata"
  | "downloading_archive"
  | "extracting_archive"
  | "analyzing_sources"
  | "applying_rules";

export interface GitHubAnalysisProgress {
  stage: GitHubAnalysisStage;
  message: string;
}

export interface GitHubIngestionLimits {
  maxRepositorySizeKb: number;
  maxArchiveBytes: number;
  maxExtractedBytes: number;
  maxFiles: number;
}

export const DEFAULT_GITHUB_INGESTION_LIMITS: GitHubIngestionLimits = {
  maxRepositorySizeKb: 100_000,
  maxArchiveBytes: 50 * 1024 * 1024,
  maxExtractedBytes: 250 * 1024 * 1024,
  maxFiles: 30_000,
};

export type GitHubIngestionErrorCode =
  | "INVALID_URL"
  | "NOT_FOUND"
  | "PRIVATE_REPOSITORY"
  | "REPOSITORY_TOO_LARGE"
  | "GITHUB_RATE_LIMITED"
  | "GITHUB_REQUEST_FAILED"
  | "ARCHIVE_TOO_LARGE"
  | "EXTRACTED_CONTENT_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "INVALID_ARCHIVE"
  | "ANALYSIS_ABORTED";

export class GitHubIngestionError extends Error {
  readonly code: GitHubIngestionErrorCode;
  readonly status?: number;

  constructor(code: GitHubIngestionErrorCode, message: string, status?: number) {
    super(message);
    this.name = "GitHubIngestionError";
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

interface GitHubRepositoryResponse {
  private: boolean;
  size: number;
  default_branch: string;
  archived: boolean;
}

interface GitHubBranchResponse {
  commit: { sha: string };
}

export interface GitHubIngestionOptions {
  fetchImpl?: typeof fetch;
  token?: string;
  limits?: Partial<GitHubIngestionLimits>;
  analysisTimestamp?: string;
  onProgress?: (progress: GitHubAnalysisProgress) => void | Promise<void>;
  signal?: AbortSignal;
}

function normalizedLimits(overrides: Partial<GitHubIngestionLimits> | undefined): GitHubIngestionLimits {
  return { ...DEFAULT_GITHUB_INGESTION_LIMITS, ...overrides };
}

function assertPositiveLimits(limits: GitHubIngestionLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`GitHub ingestion limit ${name} must be a positive finite number.`);
    }
  }
}

export function parseGitHubRepositoryUrl(input: string): GitHubRepositoryRef {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new GitHubIngestionError("INVALID_URL", "Enter a valid GitHub repository URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    throw new GitHubIngestionError("INVALID_URL", "Only standard https://github.com/owner/repository URLs are supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new GitHubIngestionError("INVALID_URL", "GitHub URL must identify exactly one owner and repository.");
  }

  const owner = parts[0]!;
  const name = parts[1]!.replace(/\.git$/i, "");
  const safe = /^[A-Za-z0-9_.-]+$/;
  if (!owner || !name || !safe.test(owner) || !safe.test(name) || owner === "." || owner === ".." || name === "." || name === "..") {
    throw new GitHubIngestionError("INVALID_URL", "GitHub owner or repository name contains unsupported characters.");
  }

  return { owner, name };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new GitHubIngestionError("ANALYSIS_ABORTED", "Repository analysis was cancelled.");
  }
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === "AbortError");
}

function githubHeaders(token?: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "CodeCity/1.0",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function requestGitHubJson<T>(
  url: string,
  fetchImpl: typeof fetch,
  token?: string,
  signal?: AbortSignal,
): Promise<T> {
  throwIfAborted(signal);
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: githubHeaders(token), redirect: "follow", signal });
  } catch (error) {
    if (isAbortError(error, signal)) throw new GitHubIngestionError("ANALYSIS_ABORTED", "Repository analysis was cancelled.");
    throw error;
  }
  if (response.ok) return response.json() as Promise<T>;

  if (response.status === 404) {
    throw new GitHubIngestionError("NOT_FOUND", "GitHub repository was not found or is not public.", 404);
  }
  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    throw new GitHubIngestionError("GITHUB_RATE_LIMITED", "GitHub API rate limit was reached. Try again later.", 403);
  }
  throw new GitHubIngestionError(
    "GITHUB_REQUEST_FAILED",
    `GitHub request failed with status ${response.status}.`,
    response.status,
  );
}

export async function resolvePublicGitHubRepository(
  repository: GitHubRepositoryRef,
  options: Pick<GitHubIngestionOptions, "fetchImpl" | "token" | "limits" | "signal"> = {},
): Promise<GitHubRepositoryMetadata> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const limits = normalizedLimits(options.limits);
  assertPositiveLimits(limits);
  const encodedOwner = encodeURIComponent(repository.owner);
  const encodedName = encodeURIComponent(repository.name);

  const repo = await requestGitHubJson<GitHubRepositoryResponse>(
    `https://api.github.com/repos/${encodedOwner}/${encodedName}`,
    fetchImpl,
    options.token,
    options.signal,
  );
  if (repo.private) {
    throw new GitHubIngestionError("PRIVATE_REPOSITORY", "CodeCity V1 only supports public GitHub repositories.");
  }
  if (repo.size > limits.maxRepositorySizeKb) {
    throw new GitHubIngestionError(
      "REPOSITORY_TOO_LARGE",
      `Repository is ${repo.size} KB; the current limit is ${limits.maxRepositorySizeKb} KB.`,
    );
  }
  if (!repo.default_branch) {
    throw new GitHubIngestionError("GITHUB_REQUEST_FAILED", "GitHub repository does not expose a default branch.");
  }

  const branch = await requestGitHubJson<GitHubBranchResponse>(
    `https://api.github.com/repos/${encodedOwner}/${encodedName}/branches/${encodeURIComponent(repo.default_branch)}`,
    fetchImpl,
    options.token,
    options.signal,
  );
  if (!branch.commit?.sha) {
    throw new GitHubIngestionError("GITHUB_REQUEST_FAILED", "GitHub default branch does not expose a commit SHA.");
  }

  return {
    ...repository,
    defaultBranch: repo.default_branch,
    commit: branch.commit.sha,
    sizeKb: repo.size,
    archived: repo.archived,
  };
}

async function downloadArchive(
  metadata: GitHubRepositoryMetadata,
  archivePath: string,
  fetchImpl: typeof fetch,
  token: string | undefined,
  maxArchiveBytes: number,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  const url = `https://api.github.com/repos/${encodeURIComponent(metadata.owner)}/${encodeURIComponent(metadata.name)}/tarball/${encodeURIComponent(metadata.commit)}`;
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: githubHeaders(token), redirect: "follow", signal });
  } catch (error) {
    if (isAbortError(error, signal)) throw new GitHubIngestionError("ANALYSIS_ABORTED", "Repository analysis was cancelled.");
    throw error;
  }
  if (!response.ok) {
    if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
      throw new GitHubIngestionError("GITHUB_RATE_LIMITED", "GitHub API rate limit was reached while fetching the source archive.", 403);
    }
    throw new GitHubIngestionError("GITHUB_REQUEST_FAILED", `GitHub archive request failed with status ${response.status}.`, response.status);
  }
  if (!response.body) {
    throw new GitHubIngestionError("GITHUB_REQUEST_FAILED", "GitHub archive response did not include a body.");
  }

  const file = await open(archivePath, "wx");
  let total = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxArchiveBytes) {
        await reader.cancel();
        throw new GitHubIngestionError(
          "ARCHIVE_TOO_LARGE",
          `Downloaded archive exceeded the ${maxArchiveBytes} byte limit.`,
        );
      }
      await file.write(value);
    }
  } finally {
    await file.close();
  }
}

async function extractArchive(
  archivePath: string,
  sourceDir: string,
  limits: GitHubIngestionLimits,
  signal?: AbortSignal,
): Promise<void> {
  let files = 0;
  let extractedBytes = 0;
  try {
    await tar.x({
      file: archivePath,
      cwd: sourceDir,
      strip: 1,
      strict: true,
      preservePaths: false,
      unlink: true,
      filter: (_path, entry) => {
        throwIfAborted(signal);
        if (!("type" in entry)) return false;
        const entryType = entry.type;
        if (entryType === "Directory") return true;
        if (entryType === "SymbolicLink" || entryType === "Link") return false;
        if (entryType !== "File" && entryType !== "OldFile" && entryType !== "ContiguousFile") return false;

        files += 1;
        extractedBytes += Math.max(0, entry.size ?? 0);
        if (files > limits.maxFiles) {
          throw new GitHubIngestionError("TOO_MANY_FILES", `Archive contains more than ${limits.maxFiles} files.`);
        }
        if (extractedBytes > limits.maxExtractedBytes) {
          throw new GitHubIngestionError(
            "EXTRACTED_CONTENT_TOO_LARGE",
            `Extracted source exceeded the ${limits.maxExtractedBytes} byte limit.`,
          );
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof GitHubIngestionError) throw error;
    throw new GitHubIngestionError(
      "INVALID_ARCHIVE",
      `Unable to extract GitHub source archive: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function emit(
  onProgress: GitHubIngestionOptions["onProgress"],
  stage: GitHubAnalysisStage,
  message: string,
): Promise<void> {
  await onProgress?.({ stage, message });
}

export type LocalRepositoryAnalyzer = (input: AnalyzeLocalRepositoryInput) => Promise<ProjectGraph>;

export async function analyzePublicGitHubRepositoryWithAnalyzer(
  repositoryUrl: string,
  analyzeLocalRepository: LocalRepositoryAnalyzer,
  options: GitHubIngestionOptions = {},
): Promise<ProjectGraph> {
  const limits = normalizedLimits(options.limits);
  assertPositiveLimits(limits);
  const fetchImpl = options.fetchImpl ?? fetch;

  throwIfAborted(options.signal);
  await emit(options.onProgress, "validating_repository", "Validating GitHub repository URL.");
  const repository = parseGitHubRepositoryUrl(repositoryUrl);

  await emit(options.onProgress, "fetching_metadata", "Resolving public repository metadata and default branch commit.");
  const metadata = await resolvePublicGitHubRepository(repository, {
    fetchImpl,
    ...(options.token ? { token: options.token } : {}),
    limits,
    signal: options.signal,
  });

  throwIfAborted(options.signal);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "codecity-github-"));
  const archivePath = join(temporaryRoot, "repository.tar.gz");
  const sourceDir = join(temporaryRoot, "source");

  try {
    await mkdir(sourceDir, { recursive: true });
    await emit(options.onProgress, "downloading_archive", "Downloading repository source archive.");
    await downloadArchive(metadata, archivePath, fetchImpl, options.token, limits.maxArchiveBytes, options.signal);

    await emit(options.onProgress, "extracting_archive", "Extracting repository into an isolated temporary workspace.");
    await extractArchive(archivePath, sourceDir, limits, options.signal);

    throwIfAborted(options.signal);
    await emit(options.onProgress, "analyzing_sources", "Parsing JavaScript and TypeScript sources without executing repository code.");
    const graph = await analyzeLocalRepository({
      rootDir: sourceDir,
      repository: {
        owner: metadata.owner,
        name: metadata.name,
        commit: metadata.commit,
      },
      analysisTimestamp: options.analysisTimestamp ?? new Date().toISOString(),
    });

    throwIfAborted(options.signal);
    await emit(options.onProgress, "applying_rules", "Applying deterministic engineering rules.");
    return applyEngineeringRules(graph);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
