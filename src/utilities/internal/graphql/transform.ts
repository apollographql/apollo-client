import type {
  DirectiveNode,
  DocumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  OperationDefinitionNode,
} from "graphql";
import { Kind, visit } from "graphql";

import type { FragmentMap } from "@apollo/client/utilities";
import {
  checkDocument,
  createFragmentMap,
  getFragmentDefinition,
  getFragmentDefinitions,
  getOperationDefinition,
  removeDirectivesFromDocument,
} from "@apollo/client/utilities";

import type { RemoveNodeConfig } from "../types/RemoveNodeConfig.js";

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

type RemoveFragmentSpreadConfig = RemoveNodeConfig<FragmentSpreadNode>;

/** @internal */
export function removeFragmentSpreadFromDocument(
  config: RemoveFragmentSpreadConfig[],
  doc: DocumentNode
): DocumentNode | null {
  function enter(
    node: FragmentSpreadNode | FragmentDefinitionNode
  ): null | void {
    if (config.some((def) => def.name === node.name.value)) {
      return null;
    }
  }

  return nullIfDocIsEmpty(
    visit(doc, {
      FragmentSpread: { enter },
      FragmentDefinition: { enter },
    })
  );
}

function isEmpty(
  op: OperationDefinitionNode | FragmentDefinitionNode,
  fragmentMap: FragmentMap
): boolean {
  return (
    !op ||
    op.selectionSet.selections.every(
      (selection) =>
        selection.kind === Kind.FRAGMENT_SPREAD &&
        isEmpty(fragmentMap[selection.name.value], fragmentMap)
    )
  );
}

/** @internal */
export function nullIfDocIsEmpty(doc: DocumentNode) {
  return (
      isEmpty(
        getOperationDefinition(doc) || getFragmentDefinition(doc),
        createFragmentMap(getFragmentDefinitions(doc))
      )
    ) ?
      null
    : doc;
}
