import type { ASTNode } from "graphql";
import { print as origPrint } from "graphql";
import { canUseWeakMap } from "../common/canUse.js";

let printCache: undefined | WeakMap<ASTNode, string>;
// further TODO: replace with `optimism` with a `WeakCache` once those are available
export const print = Object.assign(
  (ast: ASTNode) => {
    let result;
    result = printCache?.get(ast);

    if (!result) {
      result = origPrint(ast);
      printCache?.set(ast, result);
    }
    return result;
  },
  {
    reset() {
      printCache = canUseWeakMap ? new WeakMap() : undefined;
    },
  }
);

print.reset();
