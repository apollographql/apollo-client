import type { DocumentNode, OperationDefinitionNode } from "graphql";

import { invariant } from "@apollo/client/utilities/invariant";

import { getOperationDefinition } from "./getOperationDefinition.js";

/** @internal */
export function getQueryDefinition(doc: DocumentNode): OperationDefinitionNode {
  const queryDef = getOperationDefinition(doc)!;

  invariant(
    queryDef && queryDef.operation === "query",
    "Must contain a query definition."
  );

  return queryDef;
}
