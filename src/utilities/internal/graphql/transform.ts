import type { DirectiveNode, DocumentNode } from "graphql";
import { Kind, visit } from "graphql";

import {
  checkDocument,
  removeDirectivesFromDocument,
} from "@apollo/client/utilities";

/** @internal */
export function addNonReactiveToNamedFragments(document: DocumentNode) {
  checkDocument(document);

  return visit(document, {
    FragmentSpread: (node) => {
      // Do not add `@nonreactive` if the fragment is marked with `@unmask`
      // since we want to react to changes in this fragment.
      if (
        node.directives?.some((directive) => directive.name.value === "unmask")
      ) {
        return;
      }

      return {
        ...node,
        directives: [
          ...(node.directives || []),
          {
            kind: Kind.DIRECTIVE,
            name: { kind: Kind.NAME, value: "nonreactive" },
          } satisfies DirectiveNode,
        ],
      };
    },
  });
}

// Remove fields / selection sets that include an @client directive.
/** @internal */
export function removeClientSetsFromDocument(
  document: DocumentNode
): DocumentNode | null {
  checkDocument(document);

  let modifiedDoc = removeDirectivesFromDocument(
    [
      {
        test: (directive: DirectiveNode) => directive.name.value === "client",
        remove: true,
      },
    ],
    document
  );

  return modifiedDoc;
}
