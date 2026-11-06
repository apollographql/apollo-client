import type { ValueNode } from "graphql";
import { Kind } from "graphql";

import { newInvariantError } from "@apollo/client/utilities/invariant";

import { createNameNode } from "./createNameNode.js";

/**
 * @internal
 *
 * @privateRemarks
 * This function is not complete on purpose. As we need to support more types,
 * update this function with additional functionality.
 */
export function createValueNode(value: unknown): ValueNode {
  if (typeof value === "boolean") {
    return { kind: Kind.BOOLEAN, value };
  }

  if (typeof value === "string") {
    return value.startsWith("$") ?
        { kind: Kind.VARIABLE, name: createNameNode(value.replace(/^\$/, "")) }
      : { kind: Kind.STRING, value };
  }

  throw newInvariantError(
    "%s is not a supported node creation type",
    typeof value
  );
}
