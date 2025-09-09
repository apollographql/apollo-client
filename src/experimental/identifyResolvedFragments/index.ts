import type {
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
} from "graphql";
import { Kind, visit } from "graphql";

import type { ApolloClient } from "@apollo/client";
import { DocumentTransform, InMemoryCache } from "@apollo/client";
import { invariant } from "@apollo/client/utilities/invariant";

export const identifyResolvedFragments: ApolloClient.Experiment = function () {
  invariant(this.cache instanceof InMemoryCache);

  const qm = this["queryManager"] as { documentTransform: DocumentTransform };
  const parentTransform = qm.documentTransform;
  qm.documentTransform = parentTransform.concat(
    new DocumentTransform((document) => {
      function handle<T extends FragmentDefinitionNode | InlineFragmentNode>(
        fragment: T
      ): T {
        const name = `__ac_match_${
          fragment.kind === Kind.FRAGMENT_DEFINITION ?
            fragment.name.value
          : fragment.typeCondition?.name.value
        }`;
        if (!name) return fragment;
        return {
          ...fragment,
          selectionSet: {
            ...fragment.selectionSet,
            selections: [
              ...fragment.selectionSet.selections,
              {
                kind: Kind.FIELD,
                name: {
                  kind: Kind.NAME,
                  value: `__typename`,
                },
                alias: {
                  kind: Kind.NAME,
                  value: name,
                },
              } satisfies FieldNode,
            ],
          },
        };
      }
      return visit(document, {
        FragmentDefinition: handle,
        InlineFragment: handle,
      });
    })
  );
  const fragmentMatches = this.cache.fragmentMatches;
  this.cache.fragmentMatches = (fragment, typename, options) => {
    const { unnormalizedResult } = options;
    if (unnormalizedResult) {
      const name = `__ac_match_${
        fragment.kind === Kind.FRAGMENT_DEFINITION ?
          fragment.name.value
        : fragment.typeCondition?.name.value
      }`;
      if (name in unnormalizedResult) {
        return true;
      }
    }
    return fragmentMatches.call(this.cache, fragment, typename, options);
  };
};
