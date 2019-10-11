import { NormalizedCache, StoreObject } from './types';
import { Reference, isReference } from '../../utilities/graphql/storeUtils';

export function getTypenameFromStoreObject(
  store: NormalizedCache,
  storeObject: StoreObject | Reference,
): string | undefined {
  return isReference(storeObject)
    ? getTypenameFromStoreObject(store, store.get(storeObject.__ref))
    : storeObject && storeObject.__typename;
}
