import type {
  DocumentNode,
  FragmentDefinitionNode,
  SelectionSetNode,
} from "graphql";

import type {
  FragmentMap,
  FragmentMapFunction,
  Reference,
  StoreObject,
  StoreValue,
} from "@apollo/client/utilities";
import {
  compact,
  createFragmentMap,
  DeepMerger,
  getFragmentDefinitions,
  isArray,
  isField,
  isNonNullObject,
  isReference,
  resultKeyNameFromField,
  shouldInclude,
} from "@apollo/client/utilities";

import type { FragmentRegistryAPI } from "./fragmentRegistry.js";
import type { KeyFieldsContext } from "./policies.js";
import type { InMemoryCacheConfig, NormalizedCache } from "./types.js";

export const { hasOwnProperty: hasOwn } = Object.prototype;

export { isArray };

export function defaultDataIdFromObject(
  { __typename, id, _id }: Readonly<StoreObject>,
  context?: KeyFieldsContext
): string | undefined {
  if (typeof __typename === "string") {
    if (context) {
      context.keyObject =
        id != null ? { id }
        : _id != null ? { _id }
        : void 0;
    }

    // If there is no object.id, fall back to object._id.
    if (id == null && _id != null) {
      id = _id;
    }

    if (id != null) {
      return `${__typename}:${
        typeof id === "number" || typeof id === "string" ?
          id
        : JSON.stringify(id)
      }`;
    }
  }
}

const defaultConfig: InMemoryCacheConfig = {
  dataIdFromObject: defaultDataIdFromObject,
  resultCaching: true,
  // Thanks to the shouldCanonizeResults helper, this should be the only line
  // you have to change to reenable canonization by default in the future.
  canonizeResults: false,
};

export function normalizeConfig(config: InMemoryCacheConfig) {
  return compact(defaultConfig, config);
}

export function shouldCanonizeResults(
  config: Pick<InMemoryCacheConfig, "canonizeResults">
): boolean {
  const value = config.canonizeResults;
  return value === void 0 ? !!defaultConfig.canonizeResults : value;
}

export function getTypenameFromStoreObject(
  store: NormalizedCache,
  objectOrReference: StoreObject | Reference
): string | undefined {
  return isReference(objectOrReference) ?
      (store.get(objectOrReference.__ref, "__typename") as string)
    : objectOrReference && objectOrReference.__typename;
}

export const TypeOrFieldNameRegExp = /^[_a-z][_0-9a-z]*/i;

export function fieldNameFromStoreName(storeFieldName: string): string {
  const match = storeFieldName.match(TypeOrFieldNameRegExp);
  return match ? match[0] : storeFieldName;
}

export function selectionSetMatchesResult(
  selectionSet: SelectionSetNode,
  result: Record<string, any>,
  variables?: Record<string, any>
): boolean {
  if (isNonNullObject(result)) {
    return isArray(result) ?
        result.every((item) =>
          selectionSetMatchesResult(selectionSet, item, variables)
        )
      : selectionSet.selections.every((field) => {
          if (isField(field) && shouldInclude(field, variables)) {
            const key = resultKeyNameFromField(field);
            return (
              hasOwn.call(result, key) &&
              (!field.selectionSet ||
                selectionSetMatchesResult(
                  field.selectionSet,
                  result[key],
                  variables
                ))
            );
          }
          // If the selection has been skipped with @skip(true) or
          // @include(false), it should not count against the matching. If
          // the selection is not a field, it must be a fragment (inline or
          // named). We will determine if selectionSetMatchesResult for that
          // fragment when we get to it, so for now we return true.
          return true;
        });
  }
  return false;
}

export function storeValueIsStoreObject(
  value: StoreValue
): value is StoreObject {
  return isNonNullObject(value) && !isReference(value) && !isArray(value);
}

export function makeProcessedFieldsMerger() {
  return new DeepMerger();
}

export function extractFragmentContext(
  document: DocumentNode,
  fragments?: FragmentRegistryAPI
): {
  fragmentMap: FragmentMap;
  lookupFragment: FragmentMapFunction;
} {
  // FragmentMap consisting only of fragments defined directly in document, not
  // including other fragments registered in the FragmentRegistry.
  const fragmentMap = createFragmentMap(getFragmentDefinitions(document));
  return {
    fragmentMap,
    lookupFragment(name) {
      let def: FragmentDefinitionNode | null = fragmentMap[name];
      if (!def && fragments) {
        def = fragments.lookup(name);
      }
      return def || null;
    },
  };
}
