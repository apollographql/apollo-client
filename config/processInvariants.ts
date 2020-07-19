import { readFileSync, writeFileSync } from "fs";
import { resolve, relative } from "path";
import glob = require("glob");

const distDir = resolve(__dirname, "..", "dist");

glob(`${distDir}/**/*.js`, (error, files) => {
  if (error) throw error;

  files.sort().forEach(file => {
    const relPath = relative(distDir, file);

    // Outside the distDir, somehow.
    if (relPath.startsWith("../")) return;

    // Avoid re-transforming CommonJS bundle files.
    if (relPath.endsWith(".cjs.js")) return;

    const source = readFileSync(file, "utf8");
    const output = transform(source, relPath);
    if (source !== output) {
      console.log("transformed invariants in " + relPath);
      writeFileSync(file, output, "utf8");
    }
  });
});

import * as recast from "recast";
import * as parser from "recast/parsers/babel";
const b = recast.types.builders;
let nextErrorCode = 1;

function transform(code: string, id: string) {
  // If the code doesn't seem to contain anything invariant-related, we
  // can skip parsing and transforming it.
  if (!/invariant/i.test(code)) {
    return code;
  }

  const ast = recast.parse(code, { parser });

  recast.visit(ast, {
    visitCallExpression(path) {
      this.traverse(path);
      const node = path.node;

      if (isCallWithLength(node, "invariant", 1)) {
        if (isNodeEnvConditional(path.parent.node)) {
          return;
        }

        const newArgs = node.arguments.slice(0, 1);
        newArgs.push(b.numericLiteral(nextErrorCode++));

        return b.conditionalExpression(
          makeNodeEnvTest(),
          b.callExpression.from({
            ...node,
            arguments: newArgs,
          }),
          node,
        );
      }

      if (node.callee.type === "MemberExpression" &&
          isIdWithName(node.callee.object, "invariant") &&
          isIdWithName(node.callee.property, "warn", "error")) {
        if (isNodeEnvLogicalOr(path.parent.node)) {
          return;
        }
        return b.logicalExpression("||", makeNodeEnvTest(), node);
      }
    },

    visitNewExpression(path) {
      this.traverse(path);
      const node = path.node;
      if (isCallWithLength(node, "InvariantError", 0)) {
        if (isNodeEnvConditional(path.parent.node)) {
          return;
        }

        const newArgs = [
          b.numericLiteral(nextErrorCode++),
        ];

        return b.conditionalExpression(
          makeNodeEnvTest(),
          b.newExpression.from({
            ...node,
            arguments: newArgs,
          }),
          node,
        );
      }
    }
  });

  return recast.print(ast).code;
}

const n = recast.types.namedTypes;
type Node = recast.types.namedTypes.Node;
type CallExpression = recast.types.namedTypes.CallExpression;
type NewExpression = recast.types.namedTypes.NewExpression;

function isIdWithName(node: Node, ...names: string[]) {
  return n.Identifier.check(node) &&
    names.some(name => name === node.name);
}

function isCallWithLength(
  node: CallExpression | NewExpression,
  name: string,
  length: number,
) {
  return isIdWithName(node.callee, name) &&
    node.arguments.length > length;
}

function isNodeEnvConditional(node: Node) {
  return n.ConditionalExpression.check(node) &&
    isNodeEnvExpr(node.test);
}

function isNodeEnvLogicalOr(node: Node) {
  return n.LogicalExpression.check(node) &&
    node.operator === "||" &&
    isNodeEnvExpr(node.left);
}

function makeNodeEnvTest() {
  return b.binaryExpression(
    "===",
    b.memberExpression(
      b.memberExpression(
        b.identifier("process"),
        b.identifier("env")
      ),
      b.identifier("NODE_ENV"),
    ),
    b.stringLiteral("production"),
  );
}

const referenceNodeEnvExpr = makeNodeEnvTest();
function isNodeEnvExpr(node: Node) {
  return recast.types.astNodesAreEquivalent(node, referenceNodeEnvExpr);
}
