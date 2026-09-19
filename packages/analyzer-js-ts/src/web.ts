import type { ProjectGraph } from "@codecity/graph-core";
import { analyzeLocalRepositoryWithSyntax, type AnalyzeLocalRepositoryInput } from "./normalize.js";
import { analyzeSyntaxWithTypeScript } from "./syntax-typescript-pass.js";

export function analyzeLocalRepository(input: AnalyzeLocalRepositoryInput): Promise<ProjectGraph> {
  return analyzeLocalRepositoryWithSyntax({ ...input, parserVersion: "typescript" }, analyzeSyntaxWithTypeScript);
}
