import { createRequire } from "node:module";
import type { DiscoveredSourceFile } from "./file-discovery.js";

export interface SyntaxImport {
  source: string;
  kind: "static" | "dynamic";
  imported: string[];
}

export interface SyntaxExport {
  source: string | null;
  kind: "named" | "all" | "default";
  names: string[];
}

export interface SyntaxSymbol {
  kind: "function" | "class" | "interface" | "type" | "method";
  name: string;
  exported: boolean;
  start?: number;
  end?: number;
}

export interface SyntaxCall {
  name: string;
  start?: number;
  end?: number;
}

export interface SyntaxDiagnostic {
  message: string;
}

export interface SyntaxFileAnalysis {
  relativePath: string;
  loc: number;
  imports: SyntaxImport[];
  exports: SyntaxExport[];
  symbols: SyntaxSymbol[];
  calls: SyntaxCall[];
  complexity: {
    cyclomatic: number;
    maxNesting: number;
  };
  diagnostics: SyntaxDiagnostic[];
}

type AstNode = Record<string, unknown> & { type?: string; start?: number; end?: number };
type OxcParseSync = (filename: string, sourceText: string) => {
  program: Record<string, unknown>;
  errors: unknown[];
};

const require = createRequire(import.meta.url);
let cachedOxc: OxcParseSync | null | undefined;

function loadOxc(): OxcParseSync | null {
  if (cachedOxc !== undefined) return cachedOxc;
  try {
    const module = require("oxc-parser") as { parseSync?: OxcParseSync };
    cachedOxc = typeof module.parseSync === "function" ? module.parseSync : null;
  } catch {
    cachedOxc = null;
  }
  return cachedOxc;
}

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";
}

function nameOf(value: unknown): string | null {
  if (!isNode(value)) return null;
  if (value.type === "Identifier" && typeof value.name === "string") return value.name;
  if (value.type === "PrivateIdentifier" && typeof value.name === "string") return `#${value.name}`;
  if (value.type === "Literal" && typeof value.value === "string") return value.value;
  return null;
}

function literalString(value: unknown): string | null {
  if (!isNode(value)) return null;
  if (value.type === "Literal" && typeof value.value === "string") return value.value;
  if (value.type === "StringLiteral" && typeof value.value === "string") return value.value;
  return null;
}

function calleeName(value: unknown): string | null {
  if (!isNode(value)) return null;
  if (value.type === "Identifier" && typeof value.name === "string") return value.name;
  if (value.type === "MemberExpression" || value.type === "OptionalMemberExpression") {
    const object = calleeName(value.object);
    const property = nameOf(value.property);
    if (object && property) return `${object}.${property}`;
    return property ?? object;
  }
  if (value.type === "Super") return "super";
  return null;
}

function exportedName(specifier: unknown): string | null {
  if (!isNode(specifier)) return null;
  return nameOf(specifier.exported) ?? nameOf(specifier.local);
}

function countLoc(sourceText: string): number {
  if (sourceText.length === 0) return 0;
  const lines = sourceText.split(/\r\n|\r|\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.length;
}

function diagnosticMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

function namedDeclaration(node: AstNode): { kind: SyntaxSymbol["kind"]; name: string } | null {
  const id = nameOf(node.id);
  switch (node.type) {
    case "FunctionDeclaration": return id ? { kind: "function", name: id } : null;
    case "ClassDeclaration": return id ? { kind: "class", name: id } : null;
    case "TSInterfaceDeclaration": return id ? { kind: "interface", name: id } : null;
    case "TSTypeAliasDeclaration": return id ? { kind: "type", name: id } : null;
    default: return null;
  }
}

function walk(root: AstNode, visit: (node: AstNode, nesting: number) => number): void {
  const seen = new WeakSet<object>();
  function inner(node: AstNode, nesting: number): void {
    if (seen.has(node)) return;
    seen.add(node);
    const childNesting = visit(node, nesting);
    for (const [key, value] of Object.entries(node)) {
      if (key === "parent") continue;
      if (isNode(value)) inner(value, childNesting);
      else if (Array.isArray(value)) for (const item of value) if (isNode(item)) inner(item, childNesting);
    }
  }
  inner(root, 0);
}

function analyzeWithOxc(parseSync: OxcParseSync, file: DiscoveredSourceFile, sourceText: string): SyntaxFileAnalysis {
  const result = parseSync(file.relativePath, sourceText);
  const program = result.program as AstNode;
  const imports: SyntaxImport[] = [];
  const exports: SyntaxExport[] = [];
  const symbols: SyntaxSymbol[] = [];
  const calls: SyntaxCall[] = [];
  const exportedDeclarations = new WeakSet<object>();
  const body = Array.isArray(program.body) ? program.body : [];
  for (const statement of body) {
    if (!isNode(statement)) continue;
    if (statement.type === "ImportDeclaration") {
      const source = literalString(statement.source);
      if (source) {
        const imported = Array.isArray(statement.specifiers) ? statement.specifiers.flatMap((specifier) => {
          if (!isNode(specifier)) return [];
          return [nameOf(specifier.imported) ?? nameOf(specifier.local)].filter((name): name is string => name !== null);
        }) : [];
        imports.push({ source, kind: "static", imported });
      }
    }
    if (statement.type === "ExportNamedDeclaration") {
      if (isNode(statement.declaration)) exportedDeclarations.add(statement.declaration);
      const source = literalString(statement.source);
      const names = Array.isArray(statement.specifiers) ? statement.specifiers.map(exportedName).filter((name): name is string => name !== null) : [];
      exports.push({ source, kind: "named", names });
    }
    if (statement.type === "ExportAllDeclaration") exports.push({ source: literalString(statement.source), kind: "all", names: [] });
    if (statement.type === "ExportDefaultDeclaration") {
      if (isNode(statement.declaration)) exportedDeclarations.add(statement.declaration);
      exports.push({ source: null, kind: "default", names: [] });
    }
  }

  let cyclomatic = 1;
  let maxNesting = 0;
  walk(program, (node, nesting) => {
    const declaration = namedDeclaration(node);
    if (declaration) {
      symbols.push({ ...declaration, exported: exportedDeclarations.has(node), ...(typeof node.start === "number" ? { start: node.start } : {}), ...(typeof node.end === "number" ? { end: node.end } : {}) });
    }
    if (node.type === "MethodDefinition") {
      const name = nameOf(node.key);
      if (name) symbols.push({ kind: "method", name, exported: false, ...(typeof node.start === "number" ? { start: node.start } : {}), ...(typeof node.end === "number" ? { end: node.end } : {}) });
    }
    if (node.type === "CallExpression" || node.type === "NewExpression") {
      const name = calleeName(node.callee);
      if (name) calls.push({ name, ...(typeof node.start === "number" ? { start: node.start } : {}), ...(typeof node.end === "number" ? { end: node.end } : {}) });
    }
    if (node.type === "ImportExpression") {
      const source = literalString(node.source);
      if (source) imports.push({ source, kind: "dynamic", imported: [] });
    }
    const decisionNode = node.type === "IfStatement" || node.type === "ForStatement" || node.type === "ForInStatement" || node.type === "ForOfStatement" || node.type === "WhileStatement" || node.type === "DoWhileStatement" || node.type === "CatchClause" || node.type === "ConditionalExpression" || (node.type === "SwitchCase" && node.test != null) || (node.type === "LogicalExpression" && (node.operator === "&&" || node.operator === "||" || node.operator === "??"));
    if (decisionNode) cyclomatic += 1;
    const nextNesting = decisionNode || node.type === "SwitchStatement" || node.type === "TryStatement" ? nesting + 1 : nesting;
    maxNesting = Math.max(maxNesting, nextNesting);
    return nextNesting;
  });
  return finalize(file.relativePath, sourceText, imports, exports, symbols, calls, cyclomatic, maxNesting, result.errors.map((error) => ({ message: diagnosticMessage(error) })));
}

function analyzeWithTypeScript(file: DiscoveredSourceFile, sourceText: string): SyntaxFileAnalysis {
  const ts = require("typescript") as any;
  const scriptKind = ({ js: ts.ScriptKind.JS, jsx: ts.ScriptKind.JSX, ts: ts.ScriptKind.TS, tsx: ts.ScriptKind.TSX } as Record<string, number>)[file.language];
  const sourceFile = ts.createSourceFile(file.relativePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const imports: SyntaxImport[] = [];
  const exports: SyntaxExport[] = [];
  const symbols: SyntaxSymbol[] = [];
  const calls: SyntaxCall[] = [];
  let cyclomatic = 1;
  let maxNesting = 0;
  const hasModifier = (node: any, kind: number) => Array.isArray(node.modifiers) && node.modifiers.some((modifier: any) => modifier.kind === kind);
  const symbolKind = (node: any): SyntaxSymbol["kind"] | null => {
    if (ts.isFunctionDeclaration(node)) return "function";
    if (ts.isClassDeclaration(node)) return "class";
    if (ts.isInterfaceDeclaration(node)) return "interface";
    if (ts.isTypeAliasDeclaration(node)) return "type";
    if (ts.isMethodDeclaration(node)) return "method";
    return null;
  };
  function visit(node: any, nesting: number): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const imported: string[] = [];
      const clause = node.importClause;
      if (clause?.name) imported.push(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) imported.push(element.propertyName?.text ?? element.name.text);
      imports.push({ source: node.moduleSpecifier.text, kind: "static", imported });
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) imports.push({ source: node.arguments[0].text, kind: "dynamic", imported: [] });
    if (ts.isExportDeclaration(node)) {
      const source = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
      const names = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements.map((element: any) => element.name.text) : [];
      exports.push({ source, kind: node.exportClause ? "named" : "all", names });
    }
    if (ts.isExportAssignment(node)) exports.push({ source: null, kind: "default", names: [] });
    const kind = symbolKind(node);
    if (kind && node.name) symbols.push({ kind, name: node.name.getText(sourceFile), exported: hasModifier(node, ts.SyntaxKind.ExportKeyword), start: node.getStart(sourceFile), end: node.getEnd() });
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expression = node.expression;
      calls.push({ name: expression.getText(sourceFile), start: node.getStart(sourceFile), end: node.getEnd() });
    }
    let decision = false;
    if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isCatchClause(node) || ts.isConditionalExpression(node)) decision = true;
    if (ts.isCaseClause(node)) decision = true;
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) decision = true;
    if (decision) cyclomatic += 1;
    const nestingNode = decision || ts.isSwitchStatement(node) || ts.isTryStatement(node);
    const next = nestingNode ? nesting + 1 : nesting;
    maxNesting = Math.max(maxNesting, next);
    ts.forEachChild(node, (child: any) => visit(child, next));
  }
  visit(sourceFile, 0);
  const diagnostics = ((sourceFile as any).parseDiagnostics ?? []).map((diag: any) => ({ message: ts.flattenDiagnosticMessageText(diag.messageText, "\n") }));
  return finalize(file.relativePath, sourceText, imports, exports, symbols, calls, cyclomatic, maxNesting, diagnostics);
}

function finalize(relativePath: string, sourceText: string, imports: SyntaxImport[], exports: SyntaxExport[], symbols: SyntaxSymbol[], calls: SyntaxCall[], cyclomatic: number, maxNesting: number, diagnostics: SyntaxDiagnostic[]): SyntaxFileAnalysis {
  const stable = <T>(items: T[], key: (item: T) => string): T[] => items.sort((a, b) => key(a).localeCompare(key(b)));
  return {
    relativePath,
    loc: countLoc(sourceText),
    imports: stable(imports, (item) => `${item.kind}\0${item.source}`),
    exports: stable(exports, (item) => `${item.kind}\0${item.source ?? ""}\0${item.names.join(",")}`),
    symbols: stable(symbols, (item) => `${item.start ?? -1}\0${item.kind}\0${item.name}`),
    calls: stable(calls, (item) => `${item.start ?? -1}\0${item.name}`),
    complexity: { cyclomatic, maxNesting },
    diagnostics,
  };
}

export function analyzeSyntax(file: DiscoveredSourceFile, sourceText: string): SyntaxFileAnalysis {
  const oxc = loadOxc();
  return oxc ? analyzeWithOxc(oxc, file, sourceText) : analyzeWithTypeScript(file, sourceText);
}
