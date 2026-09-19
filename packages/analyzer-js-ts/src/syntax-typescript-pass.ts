import * as ts from "typescript";
import type { DiscoveredSourceFile } from "./file-discovery.js";
import type { SyntaxCall, SyntaxDiagnostic, SyntaxExport, SyntaxFileAnalysis, SyntaxImport, SyntaxSymbol } from "./syntax-pass.js";

function countLoc(sourceText: string): number {
  if (sourceText.length === 0) return 0;
  const lines = sourceText.split(/\r\n|\r|\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.length;
}

function finalize(
  relativePath: string,
  sourceText: string,
  imports: SyntaxImport[],
  exports: SyntaxExport[],
  symbols: SyntaxSymbol[],
  calls: SyntaxCall[],
  cyclomatic: number,
  maxNesting: number,
  diagnostics: SyntaxDiagnostic[],
): SyntaxFileAnalysis {
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

export function analyzeSyntaxWithTypeScript(file: DiscoveredSourceFile, sourceText: string): SyntaxFileAnalysis {
  const scriptKind = ({ js: ts.ScriptKind.JS, jsx: ts.ScriptKind.JSX, ts: ts.ScriptKind.TS, tsx: ts.ScriptKind.TSX } as Record<string, number>)[file.language];
  const sourceFile = ts.createSourceFile(file.relativePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const imports: SyntaxImport[] = [];
  const exports: SyntaxExport[] = [];
  const symbols: SyntaxSymbol[] = [];
  const calls: SyntaxCall[] = [];
  let cyclomatic = 1;
  let maxNesting = 0;

  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false);

  const symbolKind = (node: ts.Node): SyntaxSymbol["kind"] | null => {
    if (ts.isFunctionDeclaration(node)) return "function";
    if (ts.isClassDeclaration(node)) return "class";
    if (ts.isInterfaceDeclaration(node)) return "interface";
    if (ts.isTypeAliasDeclaration(node)) return "type";
    if (ts.isMethodDeclaration(node)) return "method";
    return null;
  };

  function visit(node: ts.Node, nesting: number): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const imported: string[] = [];
      const clause = node.importClause;
      if (clause?.name) imported.push(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) imported.push(element.propertyName?.text ?? element.name.text);
      }
      imports.push({ source: node.moduleSpecifier.text, kind: "static", imported });
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) imports.push({ source: argument.text, kind: "dynamic", imported: [] });
    }
    if (ts.isExportDeclaration(node)) {
      const source = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
      const names = node.exportClause && ts.isNamedExports(node.exportClause)
        ? node.exportClause.elements.map((element) => element.name.text)
        : [];
      exports.push({ source, kind: node.exportClause ? "named" : "all", names });
    }
    if (ts.isExportAssignment(node)) exports.push({ source: null, kind: "default", names: [] });

    const kind = symbolKind(node);
    const namedNode = node as ts.NamedDeclaration;
    if (kind && namedNode.name) {
      symbols.push({
        kind,
        name: namedNode.name.getText(sourceFile),
        exported: hasModifier(node, ts.SyntaxKind.ExportKeyword),
        start: node.getStart(sourceFile),
        end: node.getEnd(),
      });
    }

    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      calls.push({ name: node.expression.getText(sourceFile), start: node.getStart(sourceFile), end: node.getEnd() });
    }

    let decision = false;
    if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isCatchClause(node) || ts.isConditionalExpression(node)) decision = true;
    if (ts.isCaseClause(node)) decision = true;
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) decision = true;
    if (decision) cyclomatic += 1;
    const nestingNode = decision || ts.isSwitchStatement(node) || ts.isTryStatement(node);
    const next = nestingNode ? nesting + 1 : nesting;
    maxNesting = Math.max(maxNesting, next);
    ts.forEachChild(node, (child) => visit(child, next));
  }
  visit(sourceFile, 0);

  const parseDiagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
  const diagnostics = parseDiagnostics.map((diag) => ({ message: ts.flattenDiagnosticMessageText(diag.messageText, "\n") }));
  return finalize(file.relativePath, sourceText, imports, exports, symbols, calls, cyclomatic, maxNesting, diagnostics);
}
