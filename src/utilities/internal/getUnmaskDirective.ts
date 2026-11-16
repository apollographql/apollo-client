import type {
  DirectiveNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
} from "graphql";

/**
 * Returns the `@unmask` directive that applies to a fragment spread. An
 * `@unmask` directive on the fragment spread takes precedence over an
 * `@unmask` directive on the fragment definition.
 *
 * @internal
 */
export function getUnmaskDirective(
  spread: FragmentSpreadNode,
  fragment: FragmentDefinitionNode | null | undefined
): DirectiveNode | undefined {
  return (
    findUnmaskDirective(spread.directives) ??
    findUnmaskDirective(fragment?.directives)
  );
}

function findUnmaskDirective(
  directives: readonly DirectiveNode[] | undefined
): DirectiveNode | undefined {
  return directives?.find(({ name }) => name.value === "unmask");
}
