import type { ASTNode } from "graphql";
import { print as origPrint } from "graphql";
import { WeakCache } from "@wry/caches"

let printCache!: WeakCache<ASTNode, string>;
export const print = Object.assign(
  (ast: ASTNode) => {
    let result = printCache.get(ast);

    if (!result) {
      printCache.set(ast, result = origPrint(ast));
    }
    return result;
  },
  {
    reset() {
      printCache = new WeakCache<ASTNode, string>(/** TODO: decide on a maximum size (will do all max sizes in a combined separate PR) */);
    },
  }
);

print.reset();
