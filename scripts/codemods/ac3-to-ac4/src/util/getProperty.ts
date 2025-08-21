import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift/src/core.js";

import type { UtilContext } from "../types.js";

export function getProperty({
  context: { j },
  objectPath,
  name,
}: {
  objectPath: j.ASTPath<namedTypes.ObjectExpression>;
  context: UtilContext;
  name: string;
}): j.ASTPath<namedTypes.ObjectProperty> | null {
  return (
    (objectPath.get("properties") as j.ASTPath).filter(
      (path: j.ASTPath) =>
        j.ObjectProperty.check(path.node) &&
        j.Identifier.check(path.node.key) &&
        path.node.key.name === name
    )[0] || null
  );
}
