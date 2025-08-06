import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import * as ts from "typescript";

const __filename = fileURLToPath(import.meta.url);

interface ExportInfo {
  name: string;
  moduleName: string;
  kind: string;
  usageExamples: string[];
}

function analyze(
  entryPoint: string,
  projectRoot: string,
  moduleName = projectRoot
): ExportInfo[] {
  // Load tsconfig.json from the project root
  const configPath = path.join(projectRoot, "tsconfig.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`tsconfig.json not found at: ${configPath}`);
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(
        configFile.error.messageText,
        "\n"
      )}`
    );
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    projectRoot
  );

  if (parsedConfig.errors.length > 0) {
    console.warn("tsconfig.json parsing warnings:");
    parsedConfig.errors.forEach((error) => {
      console.warn(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
    });
  }

  // Create program with all files that might be needed for proper resolution
  // Include the entry point and let TypeScript resolve all dependencies
  const rootFiles =
    parsedConfig.fileNames.length > 0 ? parsedConfig.fileNames : [entryPoint];
  if (!rootFiles.includes(entryPoint)) {
    rootFiles.push(entryPoint);
  }

  const program = ts.createProgram(rootFiles, parsedConfig.options);
  const checker = program.getTypeChecker();

  const sourceFile = program.getSourceFile(entryPoint)!;

  // Run diagnostics to ensure proper type resolution
  ts.getPreEmitDiagnostics(program);

  return analyzeExports();

  function analyzeExports(): ExportInfo[] {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    const info = new Map<string, ExportInfo>();

    if (moduleSymbol && moduleSymbol.exports) {
      moduleSymbol.exports.forEach((symbol, name) => {
        info.set(name.toString(), analyzeExport(symbol, name.toString()));
      });
    }
    // Look for export statements
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          node.exportClause.elements.forEach((specifier) => {
            const exportName = specifier.name.text;
            const originalName = specifier.propertyName?.text || exportName;

            // Try to resolve the actual symbol being re-exported
            const resolvedSymbol = resolveReExportedSymbol(
              moduleSpecifier,
              originalName
            );

            if (resolvedSymbol) {
              info.set(exportName, analyzeExport(resolvedSymbol, exportName));
            }
          });
        }
      }
    });
    return [...info.values()];
  }

  function analyzeExport(symbol: ts.Symbol, name: string): ExportInfo {
    return {
      name,
      moduleName,
      kind: ts.SymbolFlags[symbol.flags],
      usageExamples: Array.from(collectUsageExamples(symbol, name)),
    };
  }

  function* collectUsageExamples(
    symbol: ts.Symbol,
    name: string
  ): Generator<string, void, unknown> {
    if (symbol.flags & ts.SymbolFlags.Alias) {
      yield* collectUsageExamples(checker.getAliasedSymbol(symbol), name);
      return;
    }

    const declaration = symbol.valueDeclaration || symbol.declarations?.[0];

    if (!declaration) {
      return;
    }

    let typeParameters = "";
    if (
      (ts.isInterfaceDeclaration(declaration) ||
        ts.isTypeAliasDeclaration(declaration) ||
        ts.isClassDeclaration(declaration) ||
        ts.isFunctionDeclaration(declaration) ||
        ts.isMethodDeclaration(declaration) ||
        ts.isConstructorDeclaration(declaration) ||
        ts.isFunctionExpression(declaration) ||
        ts.isArrowFunction(declaration)) &&
      declaration.typeParameters
    ) {
      typeParameters = `<${declaration.typeParameters
        .map((tp) => tp.name.text)
        .join(", ")}>`;
    }

    const identifierUc = `_Test_${name.replaceAll(".", "_")}`;
    const identifierLc = `_test_${name.replaceAll(".", "_")}`;

    if (
      ts.isInterfaceDeclaration(declaration) ||
      ts.isTypeAliasDeclaration(declaration)
    ) {
      yield `type ${identifierUc} = ${name}${typeParameters};`;
    } else if (ts.isClassDeclaration(declaration)) {
      const constructor = declaration.members.find((member) =>
        ts.isConstructorDeclaration(member)
      );
      const constructorParams =
        constructor ?
          (constructor as ts.ConstructorDeclaration).parameters
            .map((param, id) =>
              ts.isIdentifier(param.name) ? param.name.text : `param${id}`
            )
            .join(", ")
        : "";
      yield `class ${identifierUc} extends ${name}${typeParameters} {}`;
      yield `const ${identifierLc} = new ${name}${typeParameters}(${constructorParams})`;
    } else if (
      ts.isFunctionDeclaration(declaration) ||
      ts.isArrowFunction(declaration) ||
      ts.isFunctionExpression(declaration)
    ) {
      yield `${name}${typeParameters}(${declaration.parameters
        .map((param, id) =>
          ts.isIdentifier(param.name) ? param.name.text : `param${id}`
        )
        .join(", ")})`;
    } else if (ts.isModuleDeclaration(declaration)) {
      yield `const ${identifierUc} = ${name};`;
      for (const [childName, childSymbol] of symbol.exports || []) {
        collectUsageExamples(childSymbol, `${name}.${childName.toString()}`);
      }
    } else if (ts.isEnumDeclaration(declaration)) {
      yield `type ${identifierUc} = ${name};`;
    } else if (ts.isVariableDeclaration(declaration)) {
      yield `const ${identifierUc} = ${name};`;
    } else {
      throw new Error(
        `Unsupported declaration type for symbol ${name}: ${
          declaration.kind
        } - ${ts.SyntaxKind[declaration.kind]}`
      );
    }
  }

  function resolveReExportedSymbol(
    moduleSpecifier: string,
    symbolName: string
  ) {
    // Use the more advanced module resolution that handles package.json exports
    const resolvedModule = ts.resolveModuleName(
      moduleSpecifier,
      sourceFile.fileName,
      program.getCompilerOptions(),
      ts.sys
    );
    assert(resolvedModule.resolvedModule);
    const resolvedFileName = resolvedModule.resolvedModule.resolvedFileName;
    const targetSourceFile = program.getSourceFile(resolvedFileName);
    assert(targetSourceFile);
    const moduleSymbol = checker.getSymbolAtLocation(targetSourceFile);
    assert(moduleSymbol?.exports);
    const symbol = moduleSymbol.exports.get(symbolName as ts.__String);
    assert(symbol);
    return symbol;
  }
}

function writeTest(exports: ExportInfo[], moduleName: string) {
  fs.writeFileSync(
    path.join(
      import.meta.dirname,
      "..",
      "__tests__",
      `${moduleName.replace(/[@\/]/g, "_")}.generated.ts`
    ),
    `
import { describe, expect, test } from "vitest";

import imports from "../imports.js";

import { createDiff } from "./diffTransform.js";

const diff = createDiff(imports);
describe("@apollo/client", () => {


${exports
  .map(
    (info) => `
  test("${info.name}", () => {
    expect(
      diff(
        \`
import { ${info.name} } from "${info.moduleName}";
${info.usageExamples.join("\n")}
\`.trim()
      )
    ).toMatchSnapshot();
  });
`
  )
  .join("\n")}
});
`
  );
}

const args = process.argv.slice(2);
const projectRoot = path.join(import.meta.dirname, "../../../../..");

if (args.length < 2) {
  console.error(
    "Usage: tsx export-analyzer.ts src/cache/index.ts @apollo/client/cache"
  );
  console.error("       The tool will look for tsconfig.json in ", projectRoot);
  process.exit(1);
}

const [entryPoint, moduleName] = args;
// Resolve entry point relative to project root if not absolute
const resolvedEntryPoint =
  path.isAbsolute(entryPoint) ? entryPoint : (
    path.resolve(projectRoot, entryPoint)
  );

assert(fs.existsSync(resolvedEntryPoint));
assert(fs.existsSync(projectRoot));

const exports = analyze(resolvedEntryPoint, projectRoot, moduleName);
writeTest(exports, moduleName);
