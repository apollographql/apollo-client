import type { VariableNode } from "graphql";
import { Kind } from "graphql";

import { createNameNode } from "./createNameNode.js";

export function createVariableNode(name: string): VariableNode {
  return { kind: Kind.VARIABLE, name: createNameNode(name) };
}
