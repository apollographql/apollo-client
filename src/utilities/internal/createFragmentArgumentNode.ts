import type { FragmentArgumentNode, ValueNode } from "graphql";
import { Kind } from "graphql";

import { createNameNode } from "./createNameNode.js";

export function createFragmentArgumentNode(
  name: string,
  value: ValueNode
): FragmentArgumentNode {
  return {
    kind: Kind.FRAGMENT_ARGUMENT,
    name: createNameNode(name),
    value,
  };
}
