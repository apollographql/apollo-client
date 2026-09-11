import type { DirectiveNode } from "graphql";
import { Kind } from "graphql";

/** @internal */
export function getDirectiveArgValue(
  directive: DirectiveNode,
  name: string,
  kind: typeof Kind.STRING
): string | undefined;

/** @internal */
export function getDirectiveArgValue(
  directive: DirectiveNode,
  name: string,
  kind: typeof Kind.STRING
) {
  const arg = directive.arguments?.find((arg) => arg.name.value === name);
  if (!arg || arg.value.kind !== kind) return;

  switch (arg.value.kind) {
    case Kind.STRING:
      return arg.value.value;
  }
}
