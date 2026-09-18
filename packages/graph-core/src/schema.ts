import type { GRAPH_SCHEMA_VERSION } from "./index.js";

export type NodeKind =
  | "workspace"
  | "district"
  | "file"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "route"
  | "entrypoint";

export type SymbolKind = Exclude<NodeKind, "workspace" | "district" | "file">;

export type EdgeKind =
  | "imports"
  | "exports"
  | "reexports"
  | "calls"
  | "extends"
  | "implements"
  | "uses";

export type EdgeConfidence = "high" | "medium" | "low";
export type FindingSeverity = "high" | "medium" | "low" | "info";
export type SourceLanguage = "js" | "jsx" | "ts" | "tsx";

export interface SourceRange {
  start: number;
  end: number;
}

export interface RepositoryMeta {
  owner: string;
  name: string;
  commit: string;
  url?: string;
  defaultBranch?: string;
}

export interface WorkspaceNode {
  id: string;
  kind: "workspace";
  name: string;
  path: string;
}

export interface DistrictNode {
  id: string;
  kind: "district";
  name: string;
  path: string;
  workspaceId?: string;
  source: "physical" | "inferred";
  confidence?: EdgeConfidence;
}

export interface FileComplexity {
  cyclomatic: number;
  maxNesting: number;
}

export interface FileNode {
  id: string;
  kind: "file";
  name: string;
  path: string;
  language: SourceLanguage;
  loc: number;
  complexity: FileComplexity;
  symbolIds: string[];
  externalImports: string[];
  entrypoint: boolean;
  districtId?: string;
  workspaceId?: string;
}

export interface SymbolNode {
  id: string;
  kind: SymbolKind;
  name: string;
  fileId: string;
  exported: boolean;
  sourceRange?: SourceRange;
}

export interface GraphEdge {
  id: string;
  kind: EdgeKind;
  source: string;
  target: string;
  confidence: EdgeConfidence;
  sourceRange?: SourceRange;
}

export interface ProjectMetrics {
  sourceFiles: number;
  totalLoc: number;
  symbols: number;
  edges: number;
  semanticCoverage: number;
}

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  nodeIds: string[];
  metrics?: Record<string, number>;
}

export interface StaticFlow {
  id: string;
  name: string;
  entrypointId: string;
  nodeIds: string[];
  confidence: EdgeConfidence;
}

export interface AnalysisMeta {
  analyzerVersion: string;
  parserVersion: string;
  commitSha: string;
  semanticStatus: "complete" | "degraded";
  warnings: string[];
  degradedReasons: string[];
  timestamp: string;
}

export interface ProjectGraph {
  schemaVersion: typeof GRAPH_SCHEMA_VERSION;
  repository: RepositoryMeta;
  workspaces: WorkspaceNode[];
  districts: DistrictNode[];
  files: FileNode[];
  symbols: SymbolNode[];
  edges: GraphEdge[];
  metrics: ProjectMetrics;
  findings: Finding[];
  flows: StaticFlow[];
  analysis: AnalysisMeta;
}
