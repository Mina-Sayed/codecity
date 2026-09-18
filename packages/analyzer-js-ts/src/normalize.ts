import { readFile } from "node:fs/promises";
import { posix, resolve } from "node:path";
import {
  GRAPH_SCHEMA_VERSION,
  makeEdgeId,
  makeNodeId,
  normalizeGraphPath,
  type EdgeConfidence,
  type EdgeKind,
  type FileNode,
  type GraphEdge,
  type ProjectGraph,
  type RepositoryMeta,
  type SourceLanguage,
  type SymbolKind,
  type SymbolNode,
} from "@codecity/graph-core";
import { discoverSourceFiles } from "./file-discovery.js";
import { analyzeSemantics, type SemanticResult } from "./semantic-pass.js";
import { analyzeSyntax, type SyntaxFileAnalysis, type SyntaxSymbol } from "./syntax-pass.js";

export interface AnalyzeLocalRepositoryInput {
  rootDir: string;
  repository: RepositoryMeta;
  analysisTimestamp?: string;
}

const CONFIDENCE_RANK: Record<EdgeConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function toGraphSymbolKind(kind: SyntaxSymbol["kind"]): SymbolKind {
  return kind === "method" ? "function" : kind;
}

function isEntrypointPath(path: string): boolean {
  const base = posix.basename(path).toLowerCase();
  return /^(index|main|server|app)\.(?:js|jsx|ts|tsx)$/.test(base);
}

function isExternalSpecifier(specifier: string): boolean {
  return !specifier.startsWith(".") && !specifier.startsWith("/");
}

function internalImportCandidate(specifier: string, resolved: boolean): boolean {
  return resolved || specifier.startsWith(".") || specifier.startsWith("/");
}

function stableById<T extends { id: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.id.localeCompare(b.id));
}

function addEdge(
  edges: Map<string, GraphEdge>,
  kind: EdgeKind,
  source: string,
  target: string,
  confidence: EdgeConfidence,
): void {
  const id = makeEdgeId(kind, source, target);
  const existing = edges.get(id);
  if (!existing || CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[existing.confidence]) {
    edges.set(id, { id, kind, source, target, confidence });
  }
}

function makeSymbols(
  syntax: readonly SyntaxFileAnalysis[],
  fileIds: ReadonlyMap<string, string>,
): { symbols: SymbolNode[]; byFileAndName: Map<string, string> } {
  const symbols: SymbolNode[] = [];
  const byFileAndName = new Map<string, string>();

  for (const file of syntax) {
    const fileId = fileIds.get(file.relativePath);
    if (!fileId) continue;
    const occurrences = new Map<string, number>();

    for (const symbol of file.symbols) {
      const kind = toGraphSymbolKind(symbol.kind);
      const occurrenceKey = `${kind}\0${symbol.name}`;
      const occurrence = occurrences.get(occurrenceKey) ?? 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      const disambiguator = `${symbol.name}#${occurrence}`;
      const id = makeNodeId(kind, file.relativePath, disambiguator);
      const node: SymbolNode = {
        id,
        kind,
        name: symbol.name,
        fileId,
        exported: symbol.exported,
        ...(symbol.start !== undefined && symbol.end !== undefined
          ? { sourceRange: { start: symbol.start, end: symbol.end } }
          : {}),
      };
      symbols.push(node);
      const lookupKey = `${file.relativePath}\0${symbol.name}`;
      if (!byFileAndName.has(lookupKey)) byFileAndName.set(lookupKey, id);
    }
  }

  return { symbols: stableById(symbols), byFileAndName };
}

function normalizeGraph(
  input: AnalyzeLocalRepositoryInput,
  syntax: readonly SyntaxFileAnalysis[],
  semantic: SemanticResult,
  languages: ReadonlyMap<string, SourceLanguage>,
): ProjectGraph {
  const fileIds = new Map<string, string>();
  for (const file of syntax) {
    fileIds.set(file.relativePath, makeNodeId("file", file.relativePath));
  }

  const resolvedImportKeys = new Set(
    semantic.resolvedImports.map((item) => `${item.sourcePath}\0${item.specifier}`),
  );

  const files: FileNode[] = syntax.map((file) => {
    const symbolIds: string[] = [];
    const externalImports = file.imports
      .filter((item) => isExternalSpecifier(item.source) && !resolvedImportKeys.has(`${file.relativePath}\0${item.source}`))
      .map((item) => item.source)
      .sort();

    return {
      id: fileIds.get(file.relativePath)!,
      kind: "file",
      name: posix.basename(file.relativePath),
      path: file.relativePath,
      language: languages.get(file.relativePath) ?? "ts",
      loc: file.loc,
      complexity: file.complexity,
      symbolIds,
      externalImports: [...new Set(externalImports)],
      entrypoint: isEntrypointPath(file.relativePath),
    };
  });

  const { symbols, byFileAndName } = makeSymbols(syntax, fileIds);
  const symbolsByFile = new Map<string, string[]>();
  for (const symbol of symbols) {
    const bucket = symbolsByFile.get(symbol.fileId) ?? [];
    bucket.push(symbol.id);
    symbolsByFile.set(symbol.fileId, bucket);
  }
  for (const file of files) file.symbolIds = [...(symbolsByFile.get(file.id) ?? [])].sort();

  const edges = new Map<string, GraphEdge>();
  for (const item of semantic.resolvedImports) {
    const source = fileIds.get(item.sourcePath);
    const target = fileIds.get(item.targetPath);
    if (source && target) addEdge(edges, "imports", source, target, item.confidence);
  }

  for (const relation of semantic.relations) {
    if (relation.kind === "reexports") {
      const source = fileIds.get(relation.sourcePath);
      const target = fileIds.get(relation.targetPath);
      if (source && target) addEdge(edges, "reexports", source, target, relation.confidence);
      continue;
    }

    if (!relation.sourceSymbol || !relation.targetSymbol) continue;
    const source = byFileAndName.get(`${relation.sourcePath}\0${relation.sourceSymbol}`);
    const target = byFileAndName.get(`${relation.targetPath}\0${relation.targetSymbol}`);
    if (source && target) addEdge(edges, relation.kind, source, target, relation.confidence);
  }

  let internalImportCandidates = 0;
  let resolvedInternalImports = 0;
  for (const file of syntax) {
    for (const item of file.imports.filter((candidate) => candidate.kind === "static")) {
      const resolved = resolvedImportKeys.has(`${file.relativePath}\0${item.source}`);
      if (internalImportCandidate(item.source, resolved)) {
        internalImportCandidates += 1;
        if (resolved) resolvedInternalImports += 1;
      }
    }
  }

  const edgeList = stableById([...edges.values()]);
  const fileList = stableById(files);
  const totalLoc = fileList.reduce((sum, file) => sum + file.loc, 0);

  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    repository: input.repository,
    workspaces: [],
    districts: [],
    files: fileList,
    symbols,
    edges: edgeList,
    metrics: {
      sourceFiles: fileList.length,
      totalLoc,
      symbols: symbols.length,
      edges: edgeList.length,
      semanticCoverage:
        internalImportCandidates === 0 ? 1 : resolvedInternalImports / internalImportCandidates,
    },
    findings: [],
    flows: [],
    analysis: {
      analyzerVersion: "0.1.0",
      parserVersion: "oxc-parser",
      commitSha: input.repository.commit,
      semanticStatus: semantic.status,
      warnings: [...semantic.warnings],
      degradedReasons: semantic.status === "degraded" ? [...semantic.warnings] : [],
      timestamp: input.analysisTimestamp ?? "1970-01-01T00:00:00.000Z",
    },
  };
}

export async function analyzeLocalRepository(
  input: AnalyzeLocalRepositoryInput,
): Promise<ProjectGraph> {
  const rootDir = resolve(input.rootDir);
  const discovered = await discoverSourceFiles(rootDir);
  const syntax = await Promise.all(
    discovered.map(async (file) => analyzeSyntax(file, await readFile(file.absolutePath, "utf8"))),
  );
  syntax.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const semantic = await analyzeSemantics(rootDir, syntax);
  const languages = new Map(
    discovered.map((file) => [normalizeGraphPath(file.relativePath), file.language] as const),
  );

  return normalizeGraph(input, syntax, semantic, languages);
}
