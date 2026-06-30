import type { TypeNode } from "graphql";
import { Kind } from "graphql";

/** @internal */
export function getUnwrappedType(node: TypeNode) {
  switch (node.kind) {
    case Kind.NAMED_TYPE:
      return node.name.value;
    case Kind.LIST_TYPE:
      return getUnwrappedType(node.type);
    case Kind.NON_NULL_TYPE:
      return getUnwrappedType(node.type);
  }
}
