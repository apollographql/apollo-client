import * as fs from 'fs';
import { posix, join as osPathJoin } from 'path';
import { distDir, eachFile, reparse, reprint } from './helpers';
import type { ExpressionKind } from 'ast-types/lib/gen/kinds';

eachFile(distDir, (file, relPath) => {
  const source = fs.readFileSync(file, 'utf8');
  const output = transform(source, relPath);
  if (source !== output) {
    fs.writeFileSync(file, output, 'utf8');
  }
}).then(() => {
  fs.writeFileSync(
    osPathJoin(distDir, 'invariantErrorCodes.js'),
    recast.print(program, {
      tabWidth: 2,
    }).code + '\n'
  );
});

import * as recast from 'recast';
const b = recast.types.builders;
const n = recast.types.namedTypes;
type Node = recast.types.namedTypes.Node;
type CallExpression = recast.types.namedTypes.CallExpression;
type NewExpression = recast.types.namedTypes.NewExpression;
let nextErrorCode = 1;

const program = b.program([]);
const allExports = {
  errorCodes: getExportObject('errorCodes'),
  devDebug: getExportObject('devDebug'),
  devLog: getExportObject('devLog'),
  devWarn: getExportObject('devWarn'),
  devError: getExportObject('devError'),
};
type ExportName = keyof typeof allExports;

allExports.errorCodes.comments = [
  b.commentLine(
    ' This file is used by the error message display website and the',
    true
  ),
  b.commentLine(' @apollo/client/includeErrors entry point.', true),
  b.commentLine(' This file is not meant to be imported manually.', true),
];

function getExportObject(exportName: string) {
  const object = b.objectExpression([]);
  program.body.push(
    b.exportNamedDeclaration(
      b.variableDeclaration('const', [
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
  if (isIdWithName(expr.callee, 'invariant')) {
    return extractString(
      file,
      allExports[type].properties,
      expr.arguments[1],
      expr.arguments[0]
    );
  } else {
    return extractString(file, allExports[type].properties, expr.arguments[0]);
  }

  function extractString(
    file: string,
    target: typeof allExports[ExportName]['properties'],
    message: recast.types.namedTypes.SpreadElement | ExpressionKind,
    condition?: recast.types.namedTypes.SpreadElement | ExpressionKind
  ): ExpressionKind {
    if (message.type === 'ConditionalExpression') {
      return b.conditionalExpression(
        message.test,
        extractString(file, target, message.consequent, condition),
        extractString(file, target, message.alternate, condition)
      );
    } else if (isStringOnly(message)) {
      const obj = b.objectExpression([]);
      const numLit = b.numericLiteral(nextErrorCode++);
      target.push(b.property('init', numLit, obj));

      obj.properties.push(
        b.property(
          'init',
          b.identifier('file'),
          b.stringLiteral('@apollo/client/' + file)
        )
      );
      if (condition) {
        obj.properties.push(
          b.property(
            'init',
            b.identifier('condition'),
            b.stringLiteral(reprint(expr.arguments[0]))
          )
        );
      }
      obj.properties.push(b.property('init', b.identifier('message'), message));

      return numLit;
    } else {
      throw new Error(`invariant minification error: node cannot have dynamical error argument!
        file: ${posix.join(distDir, file)}:${expr.loc?.start.line}
        code:
  
        ${reprint(message)}
      `);
    }
  }
}

function transform(code: string, relativeFilePath: string) {
  // If the code doesn't seem to contain anything invariant-related, we
  // can skip parsing and transforming it.
  if (!/invariant/i.test(code)) {
    return code;
  }

  const ast = reparse(code);
  let addedDEV = false;

  recast.visit(ast, {
    visitCallExpression(path) {
      this.traverse(path);
      const node = path.node;

      if (isCallWithLength(node, 'invariant', 1)) {
        const newArgs = [...node.arguments];
        newArgs.splice(
          1,
          1,
          getErrorCode(relativeFilePath, node, 'errorCodes')
        );

        return b.callExpression.from({
          ...node,
          arguments: newArgs,
        });
      }

      if (isCallWithLength(node, 'newInvariantError', 0)) {
        const newArgs = [...node.arguments];
        newArgs.splice(
          0,
          1,
          getErrorCode(relativeFilePath, node, 'errorCodes')
        );

        return b.callExpression.from({
          ...node,
          arguments: newArgs,
        });
      }

      if (
        node.callee.type === 'MemberExpression' &&
        isIdWithName(node.callee.object, 'invariant') &&
        isIdWithName(node.callee.property, 'debug', 'log', 'warn', 'error')
      ) {
        let newNode = node;
        if (node.arguments[0].type !== 'Identifier') {
          const prop = node.callee.property;
          if (!n.Identifier.check(prop)) throw new Error('unexpected type');

          const newArgs = [...node.arguments];
          newArgs.splice(
            0,
            1,
            getErrorCode(
              relativeFilePath,
              node,
              ('dev' + capitalize(prop.name)) as ExportName
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
        addedDEV = true;
        return b.logicalExpression('&&', makeDEVExpr(), newNode);
      }
    },
  });

  if (addedDEV) {
    // Make sure there's an import { __DEV__ } from "../utilities/globals" or
    // similar declaration in any module where we injected __DEV__.
    let foundExistingImportDecl = false;

    recast.visit(ast, {
      visitImportDeclaration(path) {
        this.traverse(path);
        const node = path.node;
        const importedModuleId = node.source.value;

        // Normalize node.source.value relative to the current file.
        if (
          typeof importedModuleId === 'string' &&
          importedModuleId.startsWith('.')
        ) {
          const normalized = posix.normalize(
            posix.join(posix.dirname(relativeFilePath), importedModuleId)
          );
          if (normalized === 'utilities/globals') {
            foundExistingImportDecl = true;
            if (
              node.specifiers?.some((s) =>
                isIdWithName(s.local || s.id, '__DEV__')
              )
            ) {
              return false;
            }
            if (!node.specifiers) node.specifiers = [];
            node.specifiers.push(b.importSpecifier(b.identifier('__DEV__')));
            return false;
          }
        }
      },
    });

    if (!foundExistingImportDecl) {
      // We could modify the AST to include a new import declaration, but since
      // this code is running at build time, we can simplify things by throwing
      // here, because we expect invariant and InvariantError to be imported
      // from the utilities/globals subpackage.
      throw new Error(
        `Missing import from "${posix.relative(
          posix.dirname(relativeFilePath),
          'utilities/globals'
        )} in ${relativeFilePath}`
      );
    }
  }

  return reprint(ast);
}

function isIdWithName(node: Node | null | undefined, ...names: string[]) {
  return (
    node && n.Identifier.check(node) && names.some((name) => name === node.name)
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
    node.operator === '&&' &&
    isDEVExpr(node.left)
  );
}

function makeDEVExpr() {
  return b.identifier('__DEV__');
}

function isDEVExpr(node: Node) {
  return isIdWithName(node, '__DEV__');
}

function isStringOnly(
  node: recast.types.namedTypes.ASTNode
): node is ExpressionKind {
  switch (node.type) {
    case 'StringLiteral':
    case 'Literal':
      return true;
    case 'TemplateLiteral':
      return (node.expressions as recast.types.namedTypes.ASTNode[]).every(
        isStringOnly
      );
    case 'BinaryExpression':
      return (
        node.operator == '+' &&
        isStringOnly(node.left) &&
        isStringOnly(node.right)
      );
  }
  return false;
}

function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
