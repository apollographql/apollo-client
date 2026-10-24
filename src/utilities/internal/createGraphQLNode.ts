import type {
  FragmentArgumentNode,
  FragmentSpreadNode,
  NameNode,
  ValueNode,
  VariableNode,
} from "graphql";
import { Kind } from "graphql";

import type { Mutable } from "./types/Mutable.js";

export function createNameNode(value: string): NameNode {
  return { kind: Kind.NAME, value };
}

export function createVariableNode(name: string): VariableNode {
  return { kind: Kind.VARIABLE, name: createNameNode(name) };
}

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
