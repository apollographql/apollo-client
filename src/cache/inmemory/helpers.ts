import { NormalizedCache, StoreObject } from './types';
import { Reference, isReference } from '../../utilities/graphql/storeUtils';

export function getTypenameFromStoreObject(
  store: NormalizedCache,
  objectOrReference: StoreObject | Reference,
): string | undefined {
  return isReference(objectOrReference)
    ? store.getFieldValue(objectOrReference.__ref, "__typename") as string
    : objectOrReference && objectOrReference.__typename;
}
