import { stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { normalizeGraphPath } from "@codecity/graph-core";
import type { SyntaxFileAnalysis } from "./syntax-pass.js";

export interface ResolvedImport {
  sourcePath: string;
  specifier: string;
  targetPath: string;
  confidence: "high" | "medium";
}

export interface SemanticRelation {
  kind: "reexports" | "extends" | "implements";
  sourcePath: string;
  targetPath: string;
  confidence: "high" | "medium";
  sourceSymbol?: string;
  targetSymbol?: string;
}

export interface SemanticResult {
  status: "complete" | "degraded";
  resolvedImports: ResolvedImport[];
  relations: SemanticRelation[];
  warnings: string[];
}

const require = createRequire(import.meta.url);

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function withinRoot(rootDir: string, filePath: string): boolean {
  const root = resolve(rootDir);
  const candidate = resolve(filePath);
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function relativeGraphPath(rootDir: string, filePath: string): string {
  return normalizeGraphPath(relative(resolve(rootDir), resolve(filePath)));
}

function sortSemanticResult(result: SemanticResult): SemanticResult {
  result.resolvedImports.sort((a, b) =>
    `${a.sourcePath}\0${a.specifier}\0${a.targetPath}`.localeCompare(`${b.sourcePath}\0${b.specifier}\0${b.targetPath}`),
  );
  result.relations.sort((a, b) =>
    `${a.kind}\0${a.sourcePath}\0${a.sourceSymbol ?? ""}\0${a.targetPath}\0${a.targetSymbol ?? ""}`.localeCompare(
      `${b.kind}\0${b.sourcePath}\0${b.sourceSymbol ?? ""}\0${b.targetPath}\0${b.targetSymbol ?? ""}`,
    ),
  );
  result.warnings.sort();
  return result;
}

function importedTarget(
  sourceFile: any,
  localName: string,
): { targetPath: string; targetSymbol: string } | null {
  for (const declaration of sourceFile.getImportDeclarations()) {
    const target = declaration.getModuleSpecifierSourceFile();
    if (!target) continue;
    const defaultImport = declaration.getDefaultImport();
    if (defaultImport?.getText() === localName) return { targetPath: target.getFilePath(), targetSymbol: "default" };
    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport?.getText() === localName) return { targetPath: target.getFilePath(), targetSymbol: "*" };
    for (const named of declaration.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getNameNode().getText();
      if (local === localName) return { targetPath: target.getFilePath(), targetSymbol: named.getNameNode().getText() };
    }
  }
  return null;
}

function relationTargetTsMorph(
  sourceFile: any,
  expressionText: string,
): { targetPath: string; targetSymbol: string } | null {
  const rootIdentifier = expressionText.split(/[.<]/, 1)[0]?.trim();
  if (!rootIdentifier) return null;
  const imported = importedTarget(sourceFile, rootIdentifier);
  if (imported) return imported;
  const sameFileClass = sourceFile.getClasses().find((candidate: any) => candidate.getName() === rootIdentifier);
  if (sameFileClass) return { targetPath: sourceFile.getFilePath(), targetSymbol: rootIdentifier };
  const sameFileInterface = sourceFile.getInterfaces().find((candidate: any) => candidate.getName() === rootIdentifier);
  if (sameFileInterface) return { targetPath: sourceFile.getFilePath(), targetSymbol: rootIdentifier };
  return null;
}

async function analyzeWithTsMorph(
  rootDir: string,
  syntax: readonly SyntaxFileAnalysis[],
): Promise<SemanticResult> {
  const module = await import("ts-morph") as any;
  const { Project, ts } = module;
  const resolvedRoot = resolve(rootDir);
  const tsConfigFilePath = join(resolvedRoot, "tsconfig.json");
  const warnings: string[] = [];
  let degraded = false;
  let project: any;

  const createFallbackProject = () => {
    const fallback = new Project({
      compilerOptions: {
        allowJs: true,
        checkJs: false,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        jsx: ts.JsxEmit.Preserve,
        skipLibCheck: true,
      },
      skipAddingFilesFromTsConfig: true,
    });
    for (const file of syntax) fallback.addSourceFileAtPathIfExists(join(resolvedRoot, file.relativePath));
    return fallback;
  };

  if (await fileExists(tsConfigFilePath)) {
    try {
      project = new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: false });
    } catch (error) {
      degraded = true;
      warnings.push(`TypeScript configuration could not be loaded: ${errorMessage(error)}`);
      project = createFallbackProject();
    }
  } else {
    project = createFallbackProject();
  }

  const result: SemanticResult = {
    status: degraded ? "degraded" : "complete",
    resolvedImports: [],
    relations: [],
    warnings,
  };

  try {
    for (const sourceFile of project.getSourceFiles()) {
      const sourceAbsolute = sourceFile.getFilePath();
      if (!withinRoot(resolvedRoot, sourceAbsolute) || sourceFile.isInNodeModules?.()) continue;
      const sourcePath = relativeGraphPath(resolvedRoot, sourceAbsolute);

      for (const declaration of sourceFile.getImportDeclarations()) {
        const target = declaration.getModuleSpecifierSourceFile();
        if (!target || !withinRoot(resolvedRoot, target.getFilePath())) continue;
        result.resolvedImports.push({
          sourcePath,
          specifier: declaration.getModuleSpecifierValue(),
          targetPath: relativeGraphPath(resolvedRoot, target.getFilePath()),
          confidence: "high",
        });
      }

      for (const declaration of sourceFile.getExportDeclarations()) {
        const target = declaration.getModuleSpecifierSourceFile();
        if (!target || !withinRoot(resolvedRoot, target.getFilePath())) continue;
        result.relations.push({
          kind: "reexports",
          sourcePath,
          targetPath: relativeGraphPath(resolvedRoot, target.getFilePath()),
          confidence: "high",
        });
      }

      for (const classDeclaration of sourceFile.getClasses()) {
        const className = classDeclaration.getName();
        const extension = classDeclaration.getExtends();
        if (className && extension) {
          const target = relationTargetTsMorph(sourceFile, extension.getExpression().getText());
          if (target && withinRoot(resolvedRoot, target.targetPath)) {
            result.relations.push({
              kind: "extends",
              sourcePath,
              sourceSymbol: className,
              targetPath: relativeGraphPath(resolvedRoot, target.targetPath),
              targetSymbol: target.targetSymbol,
              confidence: "high",
            });
          }
        }
        if (className) {
          for (const implementation of classDeclaration.getImplements()) {
            const target = relationTargetTsMorph(sourceFile, implementation.getExpression().getText());
            if (target && withinRoot(resolvedRoot, target.targetPath)) {
              result.relations.push({
                kind: "implements",
                sourcePath,
                sourceSymbol: className,
                targetPath: relativeGraphPath(resolvedRoot, target.targetPath),
                targetSymbol: target.targetSymbol,
                confidence: "high",
              });
            }
          }
        }
      }
    }
  } catch (error) {
    result.status = "degraded";
    result.warnings.push(`Semantic traversal degraded: ${errorMessage(error)}`);
  }

  return sortSemanticResult(result);
}

function formatTsDiagnostic(ts: any, diagnostic: any): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

async function analyzeWithTypeScript(
  rootDir: string,
  syntax: readonly SyntaxFileAnalysis[],
): Promise<SemanticResult> {
  const ts = require("typescript") as any;
  const resolvedRoot = resolve(rootDir);
  const tsConfigFilePath = join(resolvedRoot, "tsconfig.json");
  const warnings: string[] = [];
  let degraded = false;
  let options: any = {
    allowJs: true,
    checkJs: false,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.Preserve,
    skipLibCheck: true,
  };
  let fileNames = syntax.map((file) => join(resolvedRoot, file.relativePath));

  if (await fileExists(tsConfigFilePath)) {
    const config = ts.readConfigFile(tsConfigFilePath, ts.sys.readFile);
    if (config.error) {
      degraded = true;
      warnings.push(`TypeScript configuration could not be loaded: ${formatTsDiagnostic(ts, config.error)}`);
    } else {
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolvedRoot, undefined, tsConfigFilePath);
      if (parsed.errors.length > 0) {
        degraded = true;
        warnings.push(...parsed.errors.map((item: any) => `TypeScript configuration warning: ${formatTsDiagnostic(ts, item)}`));
      } else {
        options = parsed.options;
        fileNames = parsed.fileNames.filter((path: string) => withinRoot(resolvedRoot, path));
      }
    }
  }

  const program = ts.createProgram({ rootNames: fileNames, options });
  const checker = program.getTypeChecker();
  const result: SemanticResult = {
    status: degraded ? "degraded" : "complete",
    resolvedImports: [],
    relations: [],
    warnings,
  };

  const resolveSpecifier = (sourceFile: any, specifier: string): string | null => {
    const resolvedModule = ts.resolveModuleName(specifier, sourceFile.fileName, options, ts.sys).resolvedModule;
    if (!resolvedModule) return null;
    const target = resolvedModule.resolvedFileName.replace(/\.d\.ts$/, ".ts");
    if (!withinRoot(resolvedRoot, target)) return null;
    const targetSource = program.getSourceFile(resolvedModule.resolvedFileName) ?? program.getSourceFile(target);
    return targetSource ? targetSource.fileName : target;
  };

  const symbolTarget = (node: any): { targetPath: string; targetSymbol: string } | null => {
    let symbol = checker.getSymbolAtLocation(node);
    if (!symbol) return null;
    if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol.declarations?.find((item: any) => withinRoot(resolvedRoot, item.getSourceFile().fileName));
    if (!declaration) return null;
    const sourceFile = declaration.getSourceFile();
    const name = symbol.getName?.() ?? node.getText(sourceFile);
    return { targetPath: sourceFile.fileName, targetSymbol: name };
  };

  try {
    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile || !withinRoot(resolvedRoot, sourceFile.fileName)) continue;
      const sourcePath = relativeGraphPath(resolvedRoot, sourceFile.fileName);

      for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
          const target = resolveSpecifier(sourceFile, statement.moduleSpecifier.text);
          if (target) result.resolvedImports.push({ sourcePath, specifier: statement.moduleSpecifier.text, targetPath: relativeGraphPath(resolvedRoot, target), confidence: "high" });
        }
        if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
          const target = resolveSpecifier(sourceFile, statement.moduleSpecifier.text);
          if (target) result.relations.push({ kind: "reexports", sourcePath, targetPath: relativeGraphPath(resolvedRoot, target), confidence: "high" });
        }
        if (ts.isClassDeclaration(statement) && statement.name) {
          const sourceSymbol = statement.name.text;
          for (const clause of statement.heritageClauses ?? []) {
            const kind = clause.token === ts.SyntaxKind.ExtendsKeyword ? "extends" : clause.token === ts.SyntaxKind.ImplementsKeyword ? "implements" : null;
            if (!kind) continue;
            for (const type of clause.types) {
              const target = symbolTarget(type.expression);
              if (target && withinRoot(resolvedRoot, target.targetPath)) {
                result.relations.push({ kind, sourcePath, sourceSymbol, targetPath: relativeGraphPath(resolvedRoot, target.targetPath), targetSymbol: target.targetSymbol, confidence: "high" });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    result.status = "degraded";
    result.warnings.push(`Semantic traversal degraded: ${errorMessage(error)}`);
  }

  return sortSemanticResult(result);
}

export async function analyzeSemantics(
  rootDir: string,
  syntax: readonly SyntaxFileAnalysis[],
): Promise<SemanticResult> {
  try {
    return await analyzeWithTsMorph(rootDir, syntax);
  } catch (error) {
    const fallback = await analyzeWithTypeScript(rootDir, syntax);
    return sortSemanticResult(fallback);
  }
}
