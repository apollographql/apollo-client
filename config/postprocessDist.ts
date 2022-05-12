import * as fs from "fs";
import * as path from "path";
import resolve from "resolve";
import { distDir, eachFile, reparse, reprint } from './helpers';

import { applyDistSpotFixes } from "./distSpotFixes";
applyDistSpotFixes();

// The primary goal of the 'npm run resolve' script is to make ECMAScript
// modules exposed by Apollo Client easier to consume natively in web browsers,
// without bundling, and without help from package.json files. It accomplishes
// this goal by rewriting internal ./ and ../ (relative) imports to refer to a
// specific ESM module (not a directory), including its file extension. Because
// of this limited goal, this script only touches ESM modules that have .js file
// extensions, not .cjs CommonJS bundles.

// A secondary goal of this script is to enforce that any module using the
// __DEV__ global constant imports the @apollo/client/utilities/globals polyfill
// module first.

eachFile(distDir, (file, relPath) => new Promise((resolve, reject) => {
  fs.readFile(file, "utf8", (error, source) => {
    if (error) return reject(error);

    const tr = new Transformer;
    const output = tr.transform(source, file);

    if (
      /\b__DEV__\b/.test(source) &&
      // Ignore modules that reside within @apollo/client/utilities/globals.
      relPath.split(path.sep, 2).join("/") !== "utilities/globals"
    ) {
      let importsUtilitiesGlobals = false;

      tr.absolutePaths.forEach(absPath => {
        const distRelativePath =
          path.relative(distDir, absPath).split(path.sep).join("/");
        if (distRelativePath === "utilities/globals/index.js") {
          importsUtilitiesGlobals = true;
        }
      });

      if (!importsUtilitiesGlobals) {
        reject(new Error(`Module ${
          relPath
        } uses __DEV__ but does not import @apollo/client/utilities/globals`));
      }
    }

    if (source === output) {
      resolve(file);
    } else {
      fs.writeFile(file, output, "utf8", error => {
        error ? reject(error) : resolve(file);
      });
    }
  });
}));

import * as recast from "recast";
const n = recast.types.namedTypes;
type Node = recast.types.namedTypes.Node;

class Transformer {
  absolutePaths = new Set<string>();

  transform(code: string, file: string) {
    const ast = reparse(code);
    const transformer = this;

    recast.visit(ast, {
      visitImportDeclaration(path) {
        this.traverse(path);
        transformer.normalizeSourceString(file, path.node.source);
      },

      visitImportExpression(path) {
        this.traverse(path);
        transformer.normalizeSourceString(file, path.node.source);
      },

      visitExportAllDeclaration(path) {
        this.traverse(path);
        transformer.normalizeSourceString(file, path.node.source);
      },

      visitExportNamedDeclaration(path) {
        this.traverse(path);
        transformer.normalizeSourceString(file, path.node.source);
      },
    });

    return reprint(ast);
  }

  isRelative(id: string) {
    return id.startsWith("./") || id.startsWith("../");
  }

  normalizeSourceString(file: string, source?: Node | null) {
    if (source && n.StringLiteral.check(source)) {
      // We mostly only worry about normalizing _relative_ module identifiers,
      // which start with a ./ or ../ and refer to other modules within the
      // @apollo/client package, but we also manually normalize one non-relative
      // identifier, ts-invariant/process, to prevent webpack 5 errors
      // containing the phrase "failed to resolve only because it was resolved
      // as fully specified," referring to webpack's resolve.fullySpecified
      // option, which is apparently now true by default when the enclosing
      // package's package.json file has "type": "module" (which became true for
      // Apollo Client in v3.5).
      if (source.value.split("/", 2).join("/") === "ts-invariant/process") {
        source.value = "ts-invariant/process/index.js";
      } else if (this.isRelative(source.value)) {
        try {
          source.value = this.normalizeId(source.value, file);
        } catch (error) {
          console.error(`Failed to resolve ${source.value} in ${file} with error ${error}`);
          process.exit(1);
        }
      }
    }
  }

  normalizeId(id: string, file: string) {
    const basedir = path.dirname(file);
    const absPath = resolve.sync(id, {
      basedir,
      extensions: [".mjs", ".js"],
      packageFilter(pkg) {
        return pkg.module ? {
          ...pkg,
          main: pkg.module,
        } : pkg;
      },
    });
    this.absolutePaths.add(absPath);
    const relPath = path.relative(basedir, absPath);
    const relId = relPath.split(path.sep).join('/');
    return this.isRelative(relId) ? relId : "./" + relId;
  }
}
