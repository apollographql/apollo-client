import { SelectionSetNode } from 'graphql';

import {
  NormalizedCache,
  InMemoryCacheConfig,
} from './types';

import { KeyFieldsContext } from './policies';

import {
  Reference,
  isReference,
  StoreValue,
  StoreObject,
  isField,
  DeepMerger,
  resultKeyNameFromField,
  shouldInclude,
  isNonNullObject,
  compact,
} from '../../utilities';

export const {
  hasOwnProperty: hasOwn,
} = Object.prototype;

export function defaultDataIdFromObject(
  { __typename, id, _id }: Readonly<StoreObject>,
  context?: KeyFieldsContext,
): string | undefined {
  if (typeof __typename === "string") {
    if (context) {
      context.keyObject =
         id !== void 0 ? {  id } :
        _id !== void 0 ? { _id } :
        void 0;
    }
    // If there is no object.id, fall back to object._id.
    if (id === void 0) id = _id;
    if (id !== void 0) {
      return `${__typename}:${(
        typeof id === "number" ||
        typeof id === "string"
      ) ? id : JSON.stringify(id)}`;
    }
  }
}

const defaultConfig = {
  dataIdFromObject: defaultDataIdFromObject,
  addTypename: true,
  resultCaching: true,
  // Thanks to the shouldCanonizeResults helper, this should be the only line
  // you have to change to reenable canonization by default in the future.
  canonizeResults: false,
};

export function normalizeConfig(config: InMemoryCacheConfig) {
  return compact(defaultConfig, config);
}

export function shouldCanonizeResults(
  config: Pick<InMemoryCacheConfig, "canonizeResults">,
): boolean {
  const value = config.canonizeResults;
  return value === void 0 ? defaultConfig.canonizeResults : value;
}

export function getTypenameFromStoreObject(
  store: NormalizedCache,
  objectOrReference: StoreObject | Reference,
): string | undefined {
  return isReference(objectOrReference)
    ? store.get(objectOrReference.__ref, "__typename") as string
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
  variables?: Record<string, any>,
): boolean {
  if (isNonNullObject(result)) {
    return Array.isArray(result)
      ? result.every(item => selectionSetMatchesResult(selectionSet, item, variables))
      : selectionSet.selections.every(field => {
        if (isField(field) && shouldInclude(field, variables)) {
          const key = resultKeyNameFromField(field);
          return hasOwn.call(result, key) &&
            (!field.selectionSet ||
             selectionSetMatchesResult(field.selectionSet, result[key], variables));
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
  value: StoreValue,
): value is StoreObject {
  return isNonNullObject(value) &&
    !isReference(value) &&
    !Array.isArray(value);
}

export function makeProcessedFieldsMerger() {
  return new DeepMerger;
}
