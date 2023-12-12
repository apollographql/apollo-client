import type { ASTNode } from "graphql";
import { print as origPrint } from "graphql";
import { CleanWeakCache, cacheSizes } from "../caching/index.js";
import { registerGlobalCache } from "../caching/getMemoryInternals.js";

let printCache!: CleanWeakCache<ASTNode, string>;
export const print = Object.assign(
  (ast: ASTNode) => {
    let result = printCache.get(ast);

    if (!result) {
      result = origPrint(ast);
      printCache.set(ast, result);
    }
    return result;
  },
  {
    reset() {
      printCache = new CleanWeakCache<ASTNode, string>(cacheSizes.print);
    },
  }
);
print.reset();

if (__DEV__) {
  registerGlobalCache("print", () => (printCache ? printCache.size : 0));
}
