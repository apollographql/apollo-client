import type { ASTNode } from "graphql";
import { print as origPrint } from "graphql";

import { __DEV__ } from "@apollo/client/utilities/environment";
import {
  AutoCleanedWeakCache,
  registerGlobalCache,
} from "@apollo/client/utilities/internal";

import { cacheSizes, defaultCacheSizes } from "../caching/index.js";

let printCache!: AutoCleanedWeakCache<ASTNode, string>;

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 *
 * @remarks This is the same function as the GraphQL.js `print` function but
 * with an added cache to avoid recomputation when encountering the same
 * `ASTNode` more than once.
 */
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

if (__DEV__) {
  registerGlobalCache("print", () => (printCache ? printCache.size : 0));
}
