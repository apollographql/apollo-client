import type { ArgumentNode } from "graphql";
import { Kind } from "graphql";

import { createNameNode } from "./createNameNode.js";
import { createValueNode } from "./createValueNode.js";

export function createArgumentNode(name: string, value: unknown): ArgumentNode {
  return {
    kind: Kind.ARGUMENT,
    name: createNameNode(name),
    value: createValueNode(value),
  };
}
