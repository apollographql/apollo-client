import { FieldNode, SelectionSetNode } from 'graphql';

import { NormalizedCache } from './types';
import {
  Reference,
  isReference,
  StoreValue,
  StoreObject,
  isField,
  DeepMerger,
  ReconcilerFunction,
  resultKeyNameFromField,
  shouldInclude,
} from '../../utilities';

export const hasOwn = Object.prototype.hasOwnProperty;

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
  if (result && typeof result === "object") {
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

// Invoking merge functions needs to happen after processSelectionSet has
// finished, but requires information that is more readily available
// during processSelectionSet, so processSelectionSet embeds special
// objects of the following shape within its result tree, which then must
// be removed by calling Policies#applyMerges.
export interface FieldValueToBeMerged {
  __field: FieldNode;
  __typename: string;
  __value: StoreValue;
}

export function storeValueIsStoreObject(
  value: StoreValue,
): value is StoreObject {
  return value !== null &&
    typeof value === "object" &&
    !isReference(value) &&
    !Array.isArray(value);
}

export function isFieldValueToBeMerged(
  value: any,
): value is FieldValueToBeMerged {
  const field = value && value.__field;
  return field && isField(field);
}

export function makeProcessedFieldsMerger() {
  // A DeepMerger that merges arrays and objects structurally, but otherwise
  // prefers incoming scalar values over existing values. Provides special
  // treatment for FieldValueToBeMerged objects. Used to accumulate fields
  // when processing a single selection set.
  return new DeepMerger(reconcileProcessedFields);
}

const reconcileProcessedFields: ReconcilerFunction<[]> = function (
  existingObject,
  incomingObject,
  property,
) {
  const existing = existingObject[property];
  const incoming = incomingObject[property];

  if (isFieldValueToBeMerged(existing)) {
    existing.__value = this.merge(
      existing.__value,
      isFieldValueToBeMerged(incoming)
        // TODO Check compatibility of __field and __typename properties?
        ? incoming.__value
        : incoming,
    );
    return existing;
  }

  if (isFieldValueToBeMerged(incoming)) {
    incoming.__value = this.merge(
      existing,
      incoming.__value,
    );
    return incoming;
  }

  return this.merge(existing, incoming);
}
