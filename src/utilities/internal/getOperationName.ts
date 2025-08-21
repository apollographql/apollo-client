import type { DocumentNode, OperationDefinitionNode } from "graphql";

type OperationDefinitionWithName = OperationDefinitionNode & {
  name: NonNullable<OperationDefinitionNode["name"]>;
};

/** @internal */
export function getOperationName<
  TFallback extends string | null | undefined = undefined,
>(doc: DocumentNode, fallback?: TFallback): string | TFallback {
  return (
    doc.definitions.find(
      (definition): definition is OperationDefinitionWithName =>
        definition.kind === "OperationDefinition" && !!definition.name
    )?.name.value ?? (fallback as TFallback)
  );
}
