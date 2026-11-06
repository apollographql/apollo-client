import type { DirectiveNode } from "graphql";
import { Kind } from "graphql";

import { createArgumentNode } from "./createArgumentNode.js";
import { createNameNode } from "./createNameNode.js";

export function createDirectiveNode(
  name: string,
  args: Record<string, unknown> = {}
): DirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    name: createNameNode(name),
    arguments: Object.entries(args).map(([key, value]) =>
      createArgumentNode(key, value)
    ),
  };
}
