import { print as origPrint } from "graphql";
import { canUseWeakMap } from "../common/canUse.js";

const printCache = canUseWeakMap ? new WeakMap() : undefined;
export const print: typeof origPrint = (ast) => {
  let result;
  result = printCache?.get(ast);

  if (!result) {
    result = origPrint(ast);
    printCache?.set(ast, result);
  }
  return result;
};
