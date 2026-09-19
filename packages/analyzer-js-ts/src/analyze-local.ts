import type { ProjectGraph } from "@codecity/graph-core";
import { analyzeLocalRepositoryWithSyntax, type AnalyzeLocalRepositoryInput } from "./normalize.js";
import { analyzeSyntax } from "./syntax-pass.js";

export function analyzeLocalRepository(input: AnalyzeLocalRepositoryInput): Promise<ProjectGraph> {
  return analyzeLocalRepositoryWithSyntax(input, analyzeSyntax);
}
