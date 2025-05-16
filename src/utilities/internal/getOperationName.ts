import type { DocumentNode, OperationDefinitionNode } from "graphql";

type OperationDefinitionWithName = OperationDefinitionNode & {
  name: NonNullable<OperationDefinitionNode["name"]>;
};

/** @internal */
export function getOperationName(doc: DocumentNode): string | null {
  return (
    doc.definitions.find(
      (definition): definition is OperationDefinitionWithName =>
        definition.kind === "OperationDefinition" && !!definition.name
    )?.name.value || null
  );
}
