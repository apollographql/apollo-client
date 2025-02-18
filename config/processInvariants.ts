import * as fs from "fs";
import { posix, join as osPathJoin } from "path";
import { applyRecast, reprint } from "./helpers.ts";
import type { ExpressionKind } from "ast-types/lib/gen/kinds";

import * as recast from "recast";
import type { BuildStepOptions } from "./build.ts";
const b = recast.types.builders;
const n = recast.types.namedTypes;
type Node = recast.types.namedTypes.Node;
type CallExpression = recast.types.namedTypes.CallExpression;
type NewExpression = recast.types.namedTypes.NewExpression;

export async function processInvariants(options: BuildStepOptions) {
  const program = b.program([]);
  let nextErrorCode = 1;

  const allExports = {
    errorCodes: getExportObject("errorCodes"),
    devDebug: getExportObject("devDebug"),
    devLog: getExportObject("devLog"),
    devWarn: getExportObject("devWarn"),
    devError: getExportObject("devError"),
  };
  type ExportName = keyof typeof allExports;

  allExports.errorCodes.comments = [
    b.commentLine(
      " This file is used by the error message display website and the",
      true
    ),
    b.commentLine(" @apollo/client/includeErrors entry point.", true),
    b.commentLine(" This file is not meant to be imported manually.", true),
  ];

  await applyRecast({
    cwd: options.targetDir,
    glob: `**/*.${options.jsExt}`,
    transformStep: transform,
  });

  fs.writeFileSync(
    osPathJoin(options.targetDir, `invariantErrorCodes.${options.jsExt}`),
    recast.print(program, {
      tabWidth: 2,
    }).code + "\n"
  );

  function getExportObject(exportName: string) {
    const object = b.objectExpression([]);
    program.body.push(
      b.exportNamedDeclaration(
        b.variableDeclaration("const", [
          b.variableDeclarator(b.identifier(exportName), object),
        ])
      )
    );
    return object;
  }

  function getErrorCode(
    file: string,
    expr: CallExpression | NewExpression,
    type: keyof typeof allExports
  ): ExpressionKind {
    if (isIdWithName(expr.callee, "invariant")) {
      return extractString(
        file,
        allExports[type].properties,
        expr.arguments[1],
        expr.arguments[0]
      );
    } else {
      return extractString(
        file,
        allExports[type].properties,
        expr.arguments[0]
      );
    }

    function extractString(
      file: string,
      target: (typeof allExports)[ExportName]["properties"],
      message: recast.types.namedTypes.SpreadElement | ExpressionKind,
      condition?: recast.types.namedTypes.SpreadElement | ExpressionKind
    ): ExpressionKind {
      if (message.type === "ConditionalExpression") {
        return b.conditionalExpression(
          message.test,
          extractString(file, target, message.consequent, condition),
          extractString(file, target, message.alternate, condition)
        );
      } else if (isStringOnly(message)) {
        const messageText = reprint(message);
        if (messageText.includes("Apollo DevTools")) {
          return message;
        }

        const obj = b.objectExpression([]);
        const numLit = b.numericLiteral(nextErrorCode++);
        target.push(b.property("init", numLit, obj));

        obj.properties.push(
          b.property(
            "init",
            b.identifier("file"),
            b.stringLiteral(
              options.targetDir.replace(/^dist/, "@apollo/client") + "/" + file
            )
          )
        );
        if (condition) {
          obj.properties.push(
            b.property(
              "init",
              b.identifier("condition"),
              b.stringLiteral(reprint(expr.arguments[0]))
            )
          );
        }
        obj.properties.push(
          b.property("init", b.identifier("message"), message)
        );

        return numLit;
      } else {
        throw new Error(`invariant minification error: node cannot have dynamical error argument!
        file: ${posix.join(options.targetDir, file)}:${expr.loc?.start.line}
        code:

        ${reprint(message)}
      `);
      }
    }
  }

  function transform({
    ast,
    relativeSourcePath,
  }: {
    ast: recast.types.ASTNode;
    relativeSourcePath: string;
  }) {
    if (
      relativeSourcePath !==
      osPathJoin(`utilities`, `globals`, `invariantWrappers.${options.jsExt}`)
    )
      recast.visit(ast, {
        visitCallExpression(path) {
          this.traverse(path);
          const node = path.node;

          if (isCallWithLength(node, "invariant", 1)) {
            const newArgs = [...node.arguments];
            newArgs.splice(
              1,
              1,
              getErrorCode(relativeSourcePath, node, "errorCodes")
            );

            return b.callExpression.from({
              ...node,
              arguments: newArgs,
            });
          }

          if (isCallWithLength(node, "newInvariantError", 0)) {
            const newArgs = [...node.arguments];
            newArgs.splice(
              0,
              1,
              getErrorCode(relativeSourcePath, node, "errorCodes")
            );

            return b.callExpression.from({
              ...node,
              arguments: newArgs,
            });
          }

          if (
            node.callee.type === "MemberExpression" &&
            isIdWithName(node.callee.object, "invariant") &&
            isIdWithName(node.callee.property, "debug", "log", "warn", "error")
          ) {
            let newNode = node;
            if (node.arguments[0].type !== "Identifier") {
              const prop = node.callee.property;
              if (!n.Identifier.check(prop)) throw new Error("unexpected type");

              const newArgs = [...node.arguments];
              newArgs.splice(
                0,
                1,
                getErrorCode(
                  relativeSourcePath,
                  node,
                  ("dev" + capitalize(prop.name)) as ExportName
                )
              );
              newNode = b.callExpression.from({
                ...node,
                arguments: newArgs,
              });
            }

            if (isDEVLogicalAnd(path.parent.node)) {
              return newNode;
            }
            return b.logicalExpression("&&", makeDEVExpr(), newNode);
          }
        },
      });

    if (
      ![
        osPathJoin("utilities", "globals", `index.${options.jsExt}`),
        osPathJoin("config", "jest", `setup.js`),
      ].includes(relativeSourcePath)
    )
      recast.visit(ast, {
        visitIdentifier(path) {
          this.traverse(path);
          const node = path.node;
          if (isDEVExpr(node)) {
            return b.binaryExpression(
              "!==",
              b.memberExpression(
                b.identifier("globalThis"),
                b.identifier("__DEV__")
              ),
              b.literal(false)
            );
          }
          return node;
        },
      });

    return { ast };
  }

  function _isIdWithName(node: Node | null | undefined, ...names: string[]) {
    return (
      node &&
      n.Identifier.check(node) &&
      names.some((name) => name === node.name)
    );
  }

  /**
   * wrapper around _isIdWithName that also checks for cjs-transpiled code-patterns:
   *
   * invariant(condition)
   * ^^^^^^^^^
   * in CJS:
   * (0, index_js_1.invariant)(condition)
   *                ^^^^^^^^^
   * or index_js_2.invariant.warn
   *               ^^^^^^^^^
   */
  function isIdWithName(node: Node | null | undefined, ...names: string[]) {
    return (
      _isIdWithName(node, ...names) ||
      (n.SequenceExpression.check(node) &&
        n.MemberExpression.check(node.expressions[1]) &&
        _isIdWithName(node.expressions[1].property, ...names)) ||
      (n.MemberExpression.check(node) && _isIdWithName(node.property, ...names))
    );
  }

  function isCallWithLength(
    node: CallExpression | NewExpression,
    name: string,
    length: number
  ) {
    return isIdWithName(node.callee, name) && node.arguments.length > length;
  }

  function isDEVLogicalAnd(node: Node) {
    return (
      n.LogicalExpression.check(node) &&
      node.operator === "&&" &&
      isDEVExpr(node.left)
    );
  }

  function makeDEVExpr() {
    return b.identifier("__DEV__");
  }

  function isDEVExpr(node: Node) {
    return isIdWithName(node, "__DEV__");
  }

  function isStringOnly(
    node: recast.types.namedTypes.ASTNode
  ): node is ExpressionKind {
    switch (node.type) {
      case "StringLiteral":
      case "Literal":
        return true;
      case "TemplateLiteral":
        return (node.expressions as recast.types.namedTypes.ASTNode[]).every(
          isStringOnly
        );
      case "BinaryExpression":
        return (
          node.operator == "+" &&
          isStringOnly(node.left) &&
          isStringOnly(node.right)
        );
    }
    return false;
  }

  function capitalize(str: string) {
    return str[0].toUpperCase() + str.slice(1);
  }
}
