import * as fs from "fs";
import * as path from "path";
import resolve from "resolve";
import { distDir, eachFile, reparse, reprint } from './helpers';

eachFile(distDir, (file, relPath) => new Promise((resolve, reject) => {
  fs.readFile(file, "utf8", (error, source) => {
    if (error) return reject(error);
    const output = transform(source, file);
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

function transform(code: string, file: string) {
  const ast = reparse(code);

  recast.visit(ast, {
    visitImportDeclaration(path) {
      this.traverse(path);
      normalizeSourceString(file, path.node.source);
    },

    visitImportExpression(path) {
      this.traverse(path);
      normalizeSourceString(file, path.node.source);
    },

    visitExportAllDeclaration(path) {
      this.traverse(path);
      normalizeSourceString(file, path.node.source);
    },

    visitExportNamedDeclaration(path) {
      this.traverse(path);
      normalizeSourceString(file, path.node.source);
    },
  });

  return reprint(ast);
}

function isRelative(id: string) {
  return id.startsWith("./") || id.startsWith("../");
}

function normalizeSourceString(file: string, source?: Node | null) {
  if (source && n.StringLiteral.check(source) && isRelative(source.value)) {
    try {
      source.value = normalizeId(source.value, file);
    } catch (error) {
      console.error(`Failed to resolve ${source.value} in ${file}`);
      process.exit(1);
    }
  }
}

function normalizeId(id: string, file: string) {
  const basedir = path.dirname(file);
  const absPath = resolve.sync(id, {
    basedir,
    packageFilter(pkg) {
      return pkg.module ? {
        ...pkg,
        main: pkg.module,
      } : pkg;
    },
  });
  const relPath = path.relative(basedir, absPath);
  const relId = relPath.split(path.sep).join('/');
  return isRelative(relId) ? relId : "./" + relId;
}
