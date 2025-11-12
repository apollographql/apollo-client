import type {
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
} from "graphql";
import { Kind, visit } from "graphql";

import type { ApolloClient } from "@apollo/client";
import type { InMemoryCache as InMemoryCacheBase } from "@apollo/client";
import { DocumentTransform, InMemoryCache } from "@apollo/client";
import type { Policies as PolicyBase } from "@apollo/client/cache";
import { invariant } from "@apollo/client/utilities/invariant";

type Constructor<T> = new (...args: any[]) => T;

/**
 * Mixes a MixIn onto an existing instance by swapping its prototype.
 */
function mixOn<Base, Goal extends Base>(
  instance: Base,
  Mixin: (base: Constructor<Base>) => Constructor<Goal>
): Goal {
  Object.setPrototypeOf(
    instance,
    Mixin(Object.getPrototypeOf(instance).constructor).prototype
  );
  return instance as unknown as Goal;
}

const prefix = "__ac_match_";
const inferredSuperTypeMap = Symbol();

function identificationFieldName(
  fragment: FragmentDefinitionNode | InlineFragmentNode
) {
  return (
    fragment.typeCondition && `${prefix}${fragment.typeCondition.name.value}`
  );
}

const transform = new DocumentTransform((document) => {
  function handle<T extends FragmentDefinitionNode | InlineFragmentNode>(
    fragment: T
  ): T {
    const name = identificationFieldName(fragment);
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
});

export const identifyResolvedFragments: ApolloClient.Experiment = function () {
  invariant(this.cache instanceof InMemoryCache);

  const qm = this["queryManager"] as { documentTransform: DocumentTransform };
  const parentTransform = qm.documentTransform;
  qm.documentTransform = parentTransform.concat(transform);

  const extendedPolicies = mixOn(
    this.cache.policies,
    (Base) =>
      class Policies extends Base {
        declare [inferredSuperTypeMap]?: Record<string, Record<string, true>>;

        fragmentMatches(...args: Parameters<PolicyBase["fragmentMatches"]>) {
          const [fragment, __typename, result] = args;
          const supertype = fragment.typeCondition?.name.value;

          if (__typename && __typename === supertype) {
            return true;
          }

          if (result && supertype) {
            const name = identificationFieldName(fragment);
            if (name && name in result) {
              const subtype = result[name] as string;
              this[inferredSuperTypeMap] ??= {};
              this[inferredSuperTypeMap][subtype] ??= {};
              this[inferredSuperTypeMap][subtype][supertype] = true;
              return true;
            }
          }

          if (
            __typename &&
            supertype &&
            this[inferredSuperTypeMap]?.[__typename]?.[supertype]
          ) {
            return true;
          }

          return super.fragmentMatches(...args);
        }
      }
  );

  mixOn(
    this.cache,
    (InMemoryCache) =>
      class extends InMemoryCache {
        declare policies: typeof extendedPolicies;
        public extract(...args: Parameters<InMemoryCacheBase["extract"]>) {
          return {
            ...super.extract(...args),
            __ac_inferredPossibleTypes: this.policies[inferredSuperTypeMap],
          };
        }
        public restore(
          ...[{ __ac_inferredPossibleTypes = {}, ...rest }]: Parameters<
            InMemoryCacheBase["restore"]
          >
        ) {
          this.policies[inferredSuperTypeMap] =
            __ac_inferredPossibleTypes as any;
          return super.restore(rest);
        }
      }
  );
};
