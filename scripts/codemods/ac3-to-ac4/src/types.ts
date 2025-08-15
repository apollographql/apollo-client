import type { Collection, JSCodeshift } from "jscodeshift";

export type ImportKind = "type" | "value";

export interface UtilContext {
  j: JSCodeshift;
  source: Collection<any>;
}
