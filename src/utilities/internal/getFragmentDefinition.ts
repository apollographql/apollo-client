import type { DocumentNode, FragmentDefinitionNode } from "graphql";

import { invariant } from "@apollo/client/utilities/invariant";

/** @internal */
export function getFragmentDefinition(
  doc: DocumentNode
): FragmentDefinitionNode {
  invariant(
    doc.kind === "Document",
    `Expecting a parsed GraphQL document. Perhaps you need to wrap the query \
string in a "gql" tag? http://docs.apollostack.com/apollo-client/core.html#gql`
  );

  invariant(
    doc.definitions.length <= 1,
    "Fragment must have exactly one definition."
  );

  const fragmentDef = doc.definitions[0] as FragmentDefinitionNode;

  invariant(
    fragmentDef.kind === "FragmentDefinition",
    "Must be a fragment definition."
  );

  return fragmentDef as FragmentDefinitionNode;
}
