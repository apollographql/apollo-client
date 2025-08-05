import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import assert from "assert";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExportInfo {
  name: string;
  kind: string;
  type: string;
  typeParameters?: TypeParameterInfo[];
  members?: ExportInfo[];
  isReExport?: boolean;
  sourceFile?: string;
  documentation?: string;
}

interface TypeParameterInfo {
  name: string;
  constraint?: string;
  default?: string;
}

class TypeScriptExportAnalyzer {
  private program: ts.Program;
  private checker: ts.TypeChecker;
  private sourceFile: ts.SourceFile;

  constructor(entryPoint: string, projectRoot: string) {
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

    this.program = ts.createProgram(rootFiles, parsedConfig.options);
    this.checker = this.program.getTypeChecker();

    const sourceFile = this.program.getSourceFile(entryPoint);
    if (!sourceFile) {
      throw new Error(`Could not find source file: ${entryPoint}`);
    }
    this.sourceFile = sourceFile;

    // Run diagnostics to ensure proper type resolution
    ts.getPreEmitDiagnostics(this.program);
  }

  public analyzeExports() {
    const moduleSymbol = this.checker.getSymbolAtLocation(this.sourceFile);

    if (moduleSymbol && moduleSymbol.exports) {
      moduleSymbol.exports.forEach((symbol, name) => {
        this.analyzeSymbol(symbol, name.toString());
      });
    }
    // Look for export statements
    ts.forEachChild(this.sourceFile, (node) => {
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          node.exportClause.elements.forEach((specifier) => {
            const exportName = specifier.name.text;
            const originalName = specifier.propertyName?.text || exportName;

            // Try to resolve the actual symbol being re-exported
            const resolvedSymbol = this.resolveReExportedSymbol(
              moduleSpecifier,
              originalName
            );

            if (resolvedSymbol) {
              this.analyzeSymbol(resolvedSymbol, exportName);
            }
          });
        }
      }
    });
  }

  private analyzeSymbol(symbol: ts.Symbol, name: string): void {
    if (symbol.flags & ts.SymbolFlags.Alias) {
      return this.analyzeSymbol(this.checker.getAliasedSymbol(symbol), name);
    }

    const declaration = symbol.valueDeclaration || symbol.declarations?.[0];

    if (!declaration) {
      return;
    }

    if (!name.includes(".")) {
      console.log(`
test("${name}", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts\``);

      console.log(`import {${name}} from "${this.sourceFile.fileName}";`);
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
      console.log(`type ${identifierUc} = ${name}${typeParameters};`);
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
      console.log(`class ${identifierUc} extends ${name}${typeParameters} {}`);
      console.log(
        `const ${identifierLc} = new ${name}${typeParameters}(${constructorParams})`
      );
    } else if (
      ts.isFunctionDeclaration(declaration) ||
      ts.isArrowFunction(declaration) ||
      ts.isFunctionExpression(declaration)
    ) {
      console.log(
        `${name}${typeParameters}(${declaration.parameters
          .map((param, id) =>
            ts.isIdentifier(param.name) ? param.name.text : `param${id}`
          )
          .join(", ")})`
      );
    } else if (ts.isModuleDeclaration(declaration)) {
      console.log(`const ${identifierUc} = ${name};`);
      for (const [childName, childSymbol] of symbol.exports || []) {
        this.analyzeSymbol(childSymbol, `${name}.${childName.toString()}`);
      }
    } else if (ts.isEnumDeclaration(declaration)) {
      console.log(`type ${identifierUc} = ${name};`);
    } else if (ts.isVariableDeclaration(declaration)) {
      console.log(`const ${identifierUc} = ${name};`);
    } else {
      throw new Error(
        `Unsupported declaration type for symbol ${name}: ${
          declaration.kind
        } - ${ts.SyntaxKind[declaration.kind]}`
      );
    }
    if (!name.includes(".")) {
      console.log(`\`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot();
});
`);
    }
  }

  private resolveReExportedSymbol(moduleSpecifier: string, symbolName: string) {
    // Use the more advanced module resolution that handles package.json exports
    const resolvedModule = ts.resolveModuleName(
      moduleSpecifier,
      this.sourceFile.fileName,
      this.program.getCompilerOptions(),
      ts.sys
    );
    assert(resolvedModule.resolvedModule);
    const resolvedFileName = resolvedModule.resolvedModule.resolvedFileName;
    const targetSourceFile = this.program.getSourceFile(resolvedFileName);
    assert(targetSourceFile);
    const moduleSymbol = this.checker.getSymbolAtLocation(targetSourceFile);
    assert(moduleSymbol?.exports);
    const symbol = moduleSymbol.exports.get(symbolName as ts.__String);
    assert(symbol);
    return symbol;
  }
}

const args = process.argv.slice(2);
const projectRoot = path.join(import.meta.dirname, "../../../../..");

if (args.length < 1) {
  console.error("Usage: tsx export-analyzer.ts <entry-point.ts>");
  console.error("       The tool will look for tsconfig.json in ", projectRoot);
  process.exit(1);
}

const entryPoint = args[0];
// Resolve entry point relative to project root if not absolute
const resolvedEntryPoint =
  path.isAbsolute(entryPoint) ? entryPoint : (
    path.resolve(projectRoot, entryPoint)
  );

if (!fs.existsSync(resolvedEntryPoint)) {
  console.error(`Entry point not found: ${resolvedEntryPoint}`);
  process.exit(1);
}

if (!fs.existsSync(projectRoot)) {
  console.error(`Project root not found: ${projectRoot}`);
  process.exit(1);
}

console.log(
  `
import { applyTransform } from "jscodeshift/dist/testUtils";
import { expect, test  } from "vitest";

import imports from "../imports.js";

function ts(code: TemplateStringsArray): string {
  return code[0];
}
  `.trim()
);

const overrideAs = args[1];
if (overrideAs) {
  const orig = console.log;
  console.log = (...[first, ...rest]) => {
    orig(first.replaceAll(resolvedEntryPoint, overrideAs), ...rest);
  };
}

new TypeScriptExportAnalyzer(resolvedEntryPoint, projectRoot).analyzeExports();
