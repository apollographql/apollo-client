import type { DocumentNode, OperationDefinitionNode } from "graphql";

type OperationDefinitionWithName = OperationDefinitionNode & {
  name: NonNullable<OperationDefinitionNode["name"]>;
};

/** @internal */
export function getOperationName(doc: DocumentNode): string | null {
  return (
    doc.definitions
      .filter(
        (definition): definition is OperationDefinitionWithName =>
          definition.kind === "OperationDefinition" && !!definition.name
      )
      .map((x) => x.name.value)[0] || null
  );
}
