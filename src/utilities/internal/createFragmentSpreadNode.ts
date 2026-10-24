import type { FragmentArgumentNode, FragmentSpreadNode } from "graphql";
import { Kind } from "graphql";

import { createNameNode } from "./createNameNode.js";
import type { Mutable } from "./types/Mutable.js";

export function createFragmentSpreadNode(
  name: string,
  { arguments: args }: { arguments?: FragmentArgumentNode[] } = {}
): FragmentSpreadNode {
  const node: Mutable<FragmentSpreadNode> = {
    kind: Kind.FRAGMENT_SPREAD,
    name: createNameNode(name),
  };

  if (args) {
    node.arguments = args;
  }

  return node;
}
