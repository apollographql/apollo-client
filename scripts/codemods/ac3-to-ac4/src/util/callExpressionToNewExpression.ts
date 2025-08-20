import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift/src/core.js";

import type { UtilContext } from "../types.js";

import { findReferences } from "./findReferences.js";
import { pick } from "./pick.js";

export function callExpressionToNewExpression(): (args: {
  context: UtilContext;
  namespace?: string;
  identifier: string;
  renamedSpecifierPath: j.ASTPath<namedTypes.ImportSpecifier>;
}) => void {
  return ({
    context,
    context: { j },
    identifier,
    namespace,
    renamedSpecifierPath,
  }) =>
    findReferences({
      context,
      namespace,
      identifier,
      scope: renamedSpecifierPath.scope,
    }).forEach((identifierPath) => {
      if (!j.CallExpression.check(identifierPath.parentPath.node)) {
        return;
      }
      const callPath: j.ASTPath<j.CallExpression> = identifierPath.parentPath;
      const call = callPath.node;

      callPath.replace(
        j.newExpression.from(pick(call, "callee", "comments", "arguments"))
      );
    });
}
