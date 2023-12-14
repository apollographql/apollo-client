import type { ASTNode } from "graphql";
import { print as origPrint } from "graphql";
import {
  AutoCleanedWeakCache,
  cacheSizes,
  defaultCacheSizes,
} from "../caching/index.js";

let printCache!: AutoCleanedWeakCache<ASTNode, string>;
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
      printCache = new AutoCleanedWeakCache<ASTNode, string>(
        cacheSizes.print || defaultCacheSizes.print
      );
    },
  }
);

print.reset();
