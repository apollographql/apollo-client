import type { DocumentNode, FragmentDefinitionNode } from "graphql";

/** @internal */
export function getFragmentDefinitions(
  doc: DocumentNode
): FragmentDefinitionNode[] {
  return doc.definitions.filter(
    (definition): definition is FragmentDefinitionNode =>
      definition.kind === "FragmentDefinition"
  );
}
