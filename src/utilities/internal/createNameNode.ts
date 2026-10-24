import type { NameNode } from "graphql";
import { Kind } from "graphql";

export function createNameNode(value: string): NameNode {
  return { kind: Kind.NAME, value };
}
