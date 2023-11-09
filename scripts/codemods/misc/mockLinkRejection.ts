import * as recast from "recast";
const n = recast.types.namedTypes;
const b = recast.types.builders;

export default function (fileInfo: any, api: any) {
  const ast = recast.parse(fileInfo.source, {
    parser: require("recast/parsers/typescript"),
  });

  // Transform mockSingleLink(reject, ...) to
  // mockSingleLink(...).setOnError(reject):

  const transformed = recast.visit(ast, {
    visitCallExpression(path) {
      this.traverse(path);
      const node = path.node;
      if (
        n.Identifier.check(node.callee) &&
        node.callee.name === "mockSingleLink"
      ) {
        const firstArg = node.arguments[0];
        if (
          (n.Identifier.check(firstArg) && firstArg.name === "reject") ||
          n.Function.check(firstArg)
        ) {
          path.get("arguments").shift();
          path.replace(
            b.callExpression(
              b.memberExpression(node, b.identifier("setOnError"), false),
              [firstArg]
            )
          );
        }
      }
    },
  });

  return recast.print(transformed).code;
}
