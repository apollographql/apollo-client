import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import * as ts from "typescript";
import { createRequire } from "module";

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

  return analyzeExports(sourceFile);

  function analyzeExports(sourceFile: ts.SourceFile): ExportInfo[] {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    const info = new Map<string, ExportInfo>();
    if (moduleSymbol && moduleSymbol.exports) {
      moduleSymbol.exports.forEach((symbol, name) => {
        if ((symbol.flags & ts.SymbolFlags.ExportStar) != symbol.flags) {
          info.set(name.toString(), analyzeExport(symbol, name.toString()));
        }
      });
    }
    // Look for export statements
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

        if (!node.exportClause) {
          for (const exp of analyzeExports(
            resolveSourceFile(moduleSpecifier, sourceFile)
          )) {
            info.set(exp.name, exp);
          }
        } else if (ts.isNamedExports(node.exportClause)) {
          node.exportClause.elements.forEach((specifier) => {
            const exportName = specifier.name.text;
            const originalName = specifier.propertyName?.text || exportName;

            // Try to resolve the actual symbol being re-exported
            const resolvedSymbol = resolveReExportedSymbol(
              moduleSpecifier,
              originalName,
              sourceFile
            );

            assert(
              resolvedSymbol,
              `Symbol ${originalName} not found in module ${moduleSpecifier}`
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
    if ((symbol.flags & ts.SymbolFlags.Alias) === ts.SymbolFlags.Alias) {
      return analyzeExport(checker.getAliasedSymbol(symbol), name);
    }

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
    if ((symbol.flags & ts.SymbolFlags.Alias) === ts.SymbolFlags.Alias) {
      yield* collectUsageExamples(checker.getAliasedSymbol(symbol), name);
      return;
    }

    for (const declaration of symbol.declarations || [
      symbol.valueDeclaration,
    ]) {
      if (!declaration || ts.isExportAssignment(declaration)) {
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
        ts.isFunctionExpression(declaration) ||
        ts.isMethodDeclaration(declaration)
      ) {
        yield `${name}${typeParameters}(${declaration.parameters
          .map((param, id) =>
            ts.isIdentifier(param.name) ? param.name.text : `param${id}`
          )
          .join(", ")})`;
      } else if (ts.isModuleDeclaration(declaration)) {
        yield `const ${identifierUc} = ${name};`;
        for (const [childName, childSymbol] of symbol.exports || []) {
          yield* collectUsageExamples(
            childSymbol,
            `${name}.${childName.toString()}`
          );
        }
      } else if (ts.isEnumDeclaration(declaration)) {
        yield `type ${identifierUc} = ${name};`;
      } else if (
        ts.isVariableDeclaration(declaration) ||
        ts.isPropertyDeclaration(declaration) ||
        ts.isPropertyAccessExpression(declaration)
      ) {
        yield `const ${identifierUc} = ${name};`;
      } else if (ts.isIdentifier(declaration)) {
        /*ignore*/
      } else {
        throw new Error(
          `Unsupported declaration type for symbol ${name}: ${
            declaration.kind
          } - ${ts.SyntaxKind[declaration.kind]}`
        );
      }
    }
  }

  function resolveSourceFile(
    moduleSpecifier: string,
    containingFile: ts.SourceFile
  ): ts.SourceFile {
    // Use the more advanced module resolution that handles package.json exports
    const resolvedModule = ts.resolveModuleName(
      moduleSpecifier,
      containingFile.fileName,
      program.getCompilerOptions(),
      ts.sys
    );
    assert(resolvedModule.resolvedModule);
    const resolvedFileName = resolvedModule.resolvedModule.resolvedFileName;
    const targetSourceFile = program.getSourceFile(resolvedFileName);
    assert(targetSourceFile);
    return targetSourceFile;
  }
  function resolveReExportedSymbol(
    moduleSpecifier: string,
    symbolName: string,
    containingFile: ts.SourceFile
  ): ts.Symbol | undefined {
    const targetFile = resolveSourceFile(moduleSpecifier, containingFile);
    const moduleSymbol = checker.getSymbolAtLocation(targetFile);
    assert(moduleSymbol?.exports);
    let symbol = moduleSymbol.exports.get(symbolName as ts.__String);
    if (!symbol) {
      for (const [name, sym] of moduleSymbol.exports) {
        const declaration = sym.valueDeclaration || sym.declarations?.[0];
        if (!declaration || !ts.isExportDeclaration(declaration)) {
          continue;
        }
        symbol = resolveReExportedSymbol(
          (declaration.moduleSpecifier as ts.StringLiteral).text,
          symbolName,
          targetFile
        );
        if (symbol) {
          return symbol;
        }
      }
    }
    return symbol;
  }
}

const entryPoints = [
  ["src/cache/index.ts", "@apollo/client/cache"],
  ["src/index.ts", "@apollo/client"],
  ["src/core/index.ts", "@apollo/client/core"],
  ["src/dev/index.ts", "@apollo/client/dev"],
  ["src/errors/index.ts", "@apollo/client/errors"],
  ["src/link/batch/index.ts", "@apollo/client/link/batch"],
  ["src/link/batch-http/index.ts", "@apollo/client/link/batch-http"],
  ["src/link/context/index.ts", "@apollo/client/link/context"],
  ["src/link/core/index.ts", "@apollo/client/link/core"],
  ["src/link/error/index.ts", "@apollo/client/link/error"],
  ["src/link/http/index.ts", "@apollo/client/link/http"],
  [
    "src/link/persisted-queries/index.ts",
    "@apollo/client/link/persisted-queries",
  ],
  ["src/link/retry/index.ts", "@apollo/client/link/retry"],
  ["src/link/remove-typename/index.ts", "@apollo/client/link/remove-typename"],
  ["src/link/schema/index.ts", "@apollo/client/link/schema"],
  ["src/link/subscriptions/index.ts", "@apollo/client/link/subscriptions"],
  ["src/link/utils/index.ts", "@apollo/client/link/utils"],
  ["src/link/ws/index.ts", "@apollo/client/link/ws"],
  ["src/masking/index.ts", "@apollo/client/masking"],
  ["src/react/index.ts", "@apollo/client/react"],
  ["src/react/components/index.ts", "@apollo/client/react/components"],
  ["src/react/context/index.ts", "@apollo/client/react/context"],
  ["src/react/hoc/index.ts", "@apollo/client/react/hoc"],
  ["src/react/hooks/index.ts", "@apollo/client/react/hooks"],
  ["src/react/internal/index.ts", "@apollo/client/react/internal"],
  ["src/react/parser/index.ts", "@apollo/client/react/parser"],
  ["src/react/ssr/index.ts", "@apollo/client/react/ssr"],
  ["src/testing/index.ts", "@apollo/client/testing"],
  ["src/testing/core/index.ts", "@apollo/client/testing/core"],
  ["src/testing/experimental/index.ts", "@apollo/client/testing/experimental"],
  ["src/utilities/index.ts", "@apollo/client/utilities"],
  ["src/utilities/globals/index.ts", "@apollo/client/utilities/globals"],
  [
    "src/utilities/subscriptions/urql/index.ts",
    "@apollo/client/utilities/subscriptions/relay",
  ],
];
// @ts-ignore
const projectRoot = path.join(import.meta.dirname, "../../../../..");
const require = createRequire(path.join(projectRoot, "src", "index.ts"));

if (!fs.existsSync(path.join(projectRoot, "package.json"))) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8")
  );
  if ("exports" in pkg) {
    for (const exp of Object.keys(pkg.exports)) {
      if (!entryPoints.some(([_, moduleName]) => moduleName === exp)) {
        entryPoints.push(["", exp]);
      }
    }
  }
}

const collected: Record<string, ExportInfo[]> = {};
for (const [entryPoint, moduleName] of entryPoints) {
  // Resolve entry point relative to project root if not absolute
  let resolvedEntryPoint: string | undefined = undefined;
  try {
    // for AC4 we can resolve the module directly
    resolvedEntryPoint = require.resolve(moduleName);
  } catch {
    if (moduleName === "@apollo/client/link/core") {
      try {
        // this has been renamed, for comparison sake handle it the same as before
        resolvedEntryPoint = require.resolve("@apollo/client/link");
      } catch {}
    }
  }
  if (!resolvedEntryPoint) {
    // if that didn't work we are probably dealing with AC3, use the known entry point
    resolvedEntryPoint =
      path.isAbsolute(entryPoint) ? entryPoint : (
        path.resolve(projectRoot, entryPoint)
      );
  }
  console.log(
    `Analyzing exports for module: ${moduleName} at ${resolvedEntryPoint}`
  );

  if (!fs.existsSync(resolvedEntryPoint)) {
    console.log(
      "File not found - entry point might have been deleted:",
      resolvedEntryPoint
    );
    collected[moduleName] = [];
    continue;
  }
  assert(fs.existsSync(projectRoot));

  const exports = analyze(resolvedEntryPoint, projectRoot, moduleName);
  collected[moduleName] = exports;
}

// in the end, generated files can be diffed with
/*
```sh
jq --slurpfile new src/__tests__/exports.new.json -f <(
cat <<'EOF'
with_entries(
 {
  key,
  value: (.key as $key | .value | map(.name as $name | select(($new[0][$key]|map(.name))|index($name)|not)))
    | map({
      name,
      importType: (if .kind == "Interface" or .kind == "TypeAlias" or .kind == "NamespaceModule" then "type" else "value" end)
    })
    | {
      value: . | map(select(.importType == "value")) | map(.name),
      type: . | map(select(.importType == "type")) | map(.name),
    }
  }
)
EOF
) < src/__tests__/exports.json >| src/__tests__/exports.removed.json
```
 */

fs.writeFileSync(
  // @ts-ignore
  path.join(import.meta.dirname, "..", "__tests__", "exports.json"),
  JSON.stringify(collected, null, 2)
);
