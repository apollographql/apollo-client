import type { ASTNode, ASTVisitor } from "graphql";
import { visit } from "graphql";

/** @internal */
export function checkViolations(
  tests: ASTVisitor,
  root: ASTNode
): Error | undefined {
  try {
    visit(root, tests);
  } catch (violation) {
    return violation as Error;
  }
}
