import { print as print_orig } from "graphql"
import { canUseWeakMap } from "../common/canUse"

const printCache = canUseWeakMap ? new WeakMap() : undefined;
export const print: typeof print_orig = (ast) => {
  let result;
  result = printCache?.get(ast);

  if (!result) {
    result = print_orig(ast);
    printCache?.set(ast, result);
  }
  return result;
 }
