import * as fs from "fs";
import * as path from "path";
import resolve from "resolve";
import { distDir, eachFile, reparse, reprint } from './helpers';

eachFile(distDir, (file, relPath) => new Promise((resolve, reject) => {
  fs.readFile(file, "utf8", (error, source) => {
    if (error) return reject(error);

    const tr = new Transformer;
    const output = tr.transform(source, file);

    if (
      /\b__DEV__\b/.test(source) &&
      // Ignore modules that reside within @apollo/client/utilities/globals.
      !relPath.startsWith("utilities/globals/")
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
      try {
        source.value = this.isRelative(source.value)
          ? this.normalizeId(source.value, file)
          : this.normalizeNonRelativeId(source.value, file);
      } catch (error) {
        console.error(`Failed to resolve ${source.value} in ${file} with error ${error}`);
        process.exit(1);
      }
    }
  }

  normalizeNonRelativeId(id: string, file: string) {
    const normal = this.normalizeId(id, file);
    const normalParts = normal.split("/");
    const sourceParts = id.split("/");
    const nodeModulesIndex = normalParts.lastIndexOf("node_modules");
    if (
      nodeModulesIndex >= 0 &&
      normalParts[nodeModulesIndex + 1] === sourceParts[0]
    ) {
      const bareModuleIdentifier =
        normalParts.slice(nodeModulesIndex + 1).join("/");
      if (normal === this.normalizeId(bareModuleIdentifier, file)) {
        return bareModuleIdentifier;
      }
      console.error(`Leaving ${id} import in ${file} unchanged because ${
        bareModuleIdentifier
      } does not resolve to the same module`);
    }
    return id;
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
