import { analyzeLocalRepository } from "@codecity/analyzer-js-ts/web";
import { analyzePublicGitHubRepositoryWithAnalyzer, type GitHubIngestionOptions } from "./github-core.js";

export * from "./github-core.js";

export function analyzePublicGitHubRepository(repositoryUrl: string, options: GitHubIngestionOptions = {}) {
  return analyzePublicGitHubRepositoryWithAnalyzer(repositoryUrl, analyzeLocalRepository, options);
}
