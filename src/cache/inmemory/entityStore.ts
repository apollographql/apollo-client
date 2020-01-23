import { dep, OptimisticDependencyFunction, KeyTrie } from 'optimism';
import { invariant } from 'ts-invariant';
import { equal } from '@wry/equality';

import { isReference, StoreValue } from '../../utilities/graphql/storeUtils';
import {
  DeepMerger,
  ReconcilerFunction,
} from '../../utilities/common/mergeDeep';
import { canUseWeakMap } from '../../utilities/common/canUse';
import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';
import {
  getTypenameFromStoreObject,
  fieldNameFromStoreName,
} from './helpers';

const hasOwn = Object.prototype.hasOwnProperty;

export abstract class EntityStore implements NormalizedCache {
  protected data: NormalizedCacheObject = Object.create(null);

  public readonly group: CacheGroup;

  public abstract addLayer(
    layerId: string,
    replay: (layer: EntityStore) => any,
  ): EntityStore;

  public abstract removeLayer(layerId: string): EntityStore;

  // Although the EntityStore class is abstract, it contains concrete
  // implementations of the various NormalizedCache interface methods that
  // are inherited by the Root and Layer subclasses.

  public toObject(): NormalizedCacheObject {
    return { ...this.data };
  }

  public has(dataId: string): boolean {
    return this.lookup(dataId, true) !== void 0;
  }

  public get(dataId: string, fieldName: string): StoreValue {
    this.group.depend(dataId, fieldName);
    if (hasOwn.call(this.data, dataId)) {
      const storeObject = this.data[dataId];
      if (storeObject && hasOwn.call(storeObject, fieldName)) {
        return storeObject[fieldName];
      }
    }
    if (this instanceof Layer) {
      return this.parent.get(dataId, fieldName);
    }
  }

  private lookup(dataId: string, dependOnExistence?: boolean): StoreObject {
    // The has method (above) calls lookup with dependOnExistence = true, so
    // that it can later be invalidated when we add or remove a StoreObject for
    // this dataId. Any consumer who cares about the contents of the StoreObject
    // should not rely on this dependency, since the contents could change
    // without the object being added or removed.
    if (dependOnExistence) this.group.depend(dataId, "__exists");
    return hasOwn.call(this.data, dataId) ? this.data[dataId] :
      this instanceof Layer ? this.parent.lookup(dataId, dependOnExistence) : void 0;
  }

  public merge(dataId: string, incoming: StoreObject): void {
    const existing = this.lookup(dataId);
    const merged = new DeepMerger(storeObjectReconciler).merge(existing, incoming, this);
    if (merged !== existing) {
      this.data[dataId] = merged;
      delete this.refs[dataId];
      if (this.group.caching) {
        // If we added a new StoreObject where there was previously none, dirty
        // anything that depended on the existence of this dataId, such as the
        // EntityStore#has method.
        if (!existing) this.group.dirty(dataId, "__exists");
        // Now invalidate dependents who called getFieldValue for any
        // fields that are changing as a result of this merge.
        Object.keys(incoming).forEach(storeFieldName => {
          if (!existing || incoming[storeFieldName] !== existing[storeFieldName]) {
            this.group.dirty(dataId, storeFieldName);
          }
        });
      }
    }
  }

  // If called with only one argument, removes the entire entity
  // identified by dataId. If called with a fieldName as well, removes all
  // fields of that entity whose names match fieldName, according to the
  // fieldNameFromStoreName helper function.
  public delete(dataId: string, fieldName?: string) {
    const storeObject = this.lookup(dataId);

    if (storeObject) {
      // In case someone passes in a storeFieldName (field.name.value +
      // arguments key), normalize it down to just the field name.
      fieldName = fieldName && fieldNameFromStoreName(fieldName);

      const storeNamesToDelete = Object.keys(storeObject).filter(
        // If the field value has already been set to undefined, we do not
        // need to delete it again.
        storeFieldName => storeObject[storeFieldName] !== void 0 &&
          // If no fieldName provided, delete all fields from storeObject.
          // If provided, delete all fields matching fieldName.
          (!fieldName || fieldName === fieldNameFromStoreName(storeFieldName)));

      if (storeNamesToDelete.length) {
        // If we only have to worry about the Root layer of the store,
        // then we can safely delete fields within entities, or whole
        // entities by ID. If this instanceof EntityStore.Layer, however,
        // then we need to set the "deleted" values to undefined instead
        // of actually deleting them, so the deletion does not un-shadow
        // values inherited from lower layers of the store.
        const canDelete = this instanceof EntityStore.Root;
        const remove = (obj: Record<string, any>, key: string) => {
          if (canDelete) {
            delete obj[key];
          } else {
            obj[key] = void 0;
          }
        };

        // Note that we do not delete the this.rootIds[dataId] retainment
        // count for this ID, since an object with the same ID could appear in
        // the store again, and should not have to be retained again.
        // delete this.rootIds[dataId];
        delete this.refs[dataId];

        const fieldsToDirty = new Set<string>();

        if (fieldName) {
          // If we have a fieldName and it matches more than zero fields,
          // then we need to make a copy of this.data[dataId] without the
          // fields that are getting deleted.
          const cleaned = this.data[dataId] = { ...storeObject };
          storeNamesToDelete.forEach(storeFieldName => {
            remove(cleaned, storeFieldName);
          });
          // Although it would be logically correct to dirty each
          // storeFieldName in the loop above, we know that they all have
          // the same name, according to fieldNameFromStoreName.
          fieldsToDirty.add(fieldName);
        } else {
          // If no fieldName was provided, then we delete the whole entity
          // from the cache.
          remove(this.data, dataId);
          storeNamesToDelete.forEach(storeFieldName => {
            fieldsToDirty.add(fieldNameFromStoreName(storeFieldName));
          });
          // Let dependents (such as EntityStore#has) know that this dataId has
          // been removed from this layer of the store.
          fieldsToDirty.add("__exists");
        }

        if (this.group.caching) {
          fieldsToDirty.forEach(fieldName => {
            this.group.dirty(dataId, fieldName);
          });
        }

        return true;
      }
    }

    return false;
  }

  public evict(dataId: string, fieldName?: string): boolean {
    let evicted = this.delete(dataId, fieldName);
    if (this instanceof Layer) {
      evicted = this.parent.evict(dataId, fieldName) || evicted;
    }
    return evicted;
  }

  public clear(): void {
    this.replace(null);
  }

  public replace(newData: NormalizedCacheObject | null): void {
    Object.keys(this.data).forEach(dataId => {
      if (!(newData && hasOwn.call(newData, dataId))) {
        this.delete(dataId);
      }
    });
    if (newData) {
      Object.keys(newData).forEach(dataId => {
        this.merge(dataId, newData[dataId]);
      });
    }
  }

  // Maps root entity IDs to the number of times they have been retained, minus
  // the number of times they have been released. Retained entities keep other
  // entities they reference (even indirectly) from being garbage collected.
  private rootIds: {
    [rootId: string]: number;
  } = Object.create(null);

  public retain(rootId: string): number {
    return this.rootIds[rootId] = (this.rootIds[rootId] || 0) + 1;
  }

  public release(rootId: string): number {
    if (this.rootIds[rootId] > 0) {
      const count = --this.rootIds[rootId];
      if (!count) delete this.rootIds[rootId];
      return count;
    }
    return 0;
  }

  // Return a Set<string> of all the ID strings that have been retained by
  // this layer/root *and* any layers/roots beneath it.
  public getRootIdSet(ids = new Set<string>()) {
    Object.keys(this.rootIds).forEach(ids.add, ids);
    if (this instanceof Layer) {
      this.parent.getRootIdSet(ids);
    }
    return ids;
  }

  // The goal of garbage collection is to remove IDs from the Root layer of the
  // store that are no longer reachable starting from any IDs that have been
  // explicitly retained (see retain and release, above). Returns an array of
  // dataId strings that were removed from the store.
  public gc() {
    const ids = this.getRootIdSet();
    const snapshot = this.toObject();
    ids.forEach(id => {
      if (hasOwn.call(snapshot, id)) {
        // Because we are iterating over an ECMAScript Set, the IDs we add here
        // will be visited in later iterations of the forEach loop only if they
        // were not previously contained by the Set.
        Object.keys(this.findChildRefIds(id)).forEach(ids.add, ids);
        // By removing IDs from the snapshot object here, we protect them from
        // getting removed from the root store layer below.
        delete snapshot[id];
      }
    });
    const idsToRemove = Object.keys(snapshot);
    if (idsToRemove.length) {
      let root: EntityStore = this;
      while (root instanceof Layer) root = root.parent;
      idsToRemove.forEach(id => root.delete(id));
    }
    return idsToRemove;
  }

  // Lazily tracks { __ref: <dataId> } strings contained by this.data[dataId].
  private refs: {
    [dataId: string]: Record<string, true>;
  } = Object.create(null);

  public findChildRefIds(dataId: string): Record<string, true> {
    if (!hasOwn.call(this.refs, dataId)) {
      const found = this.refs[dataId] = Object.create(null);
      const workSet = new Set([this.data[dataId]]);
      // Within the store, only arrays and objects can contain child entity
      // references, so we can prune the traversal using this predicate:
      const canTraverse = (obj: any) => obj !== null && typeof obj === 'object';
      workSet.forEach(obj => {
        if (isReference(obj)) {
          found[obj.__ref] = true;
        } else if (canTraverse(obj)) {
          Object.values(obj)
            // No need to add primitive values to the workSet, since they cannot
            // contain reference objects.
            .filter(canTraverse)
            .forEach(workSet.add, workSet);
        }
      });
    }
    return this.refs[dataId];
  }

  // Used to compute cache keys specific to this.group.
  public makeCacheKey(...args: any[]) {
    return this.group.keyMaker.lookupArray(args);
  }
}

// A single CacheGroup represents a set of one or more EntityStore objects,
// typically the Root store in a CacheGroup by itself, and all active Layer
// stores in a group together. A single EntityStore object belongs to only
// one CacheGroup, store.group. The CacheGroup is responsible for tracking
// dependencies, so store.group is helpful for generating unique keys for
// cached results that need to be invalidated when/if those dependencies
// change. If we used the EntityStore objects themselves as cache keys (that
// is, store rather than store.group), the cache would become unnecessarily
// fragmented by all the different Layer objects. Instead, the CacheGroup
// approach allows all optimistic Layer objects in the same linked list to
// belong to one CacheGroup, with the non-optimistic Root object belonging
// to another CacheGroup, allowing resultCaching dependencies to be tracked
// separately for optimistic and non-optimistic entity data.
class CacheGroup {
  private d: OptimisticDependencyFunction<string> | null = null;

  constructor(public readonly caching: boolean) {
    this.d = caching ? dep<string>() : null;
  }

  public depend(dataId: string, storeFieldName: string) {
    if (this.d) {
      this.d(makeDepKey(dataId, storeFieldName));
    }
  }

  public dirty(dataId: string, storeFieldName: string) {
    if (this.d) {
      this.d.dirty(makeDepKey(dataId, storeFieldName));
    }
  }

  // Used by the EntityStore#makeCacheKey method to compute cache keys
  // specific to this CacheGroup.
  public readonly keyMaker = new KeyTrie<object>(canUseWeakMap);
}

function makeDepKey(dataId: string, storeFieldName: string) {
  return JSON.stringify([dataId, fieldNameFromStoreName(storeFieldName)]);
}

export namespace EntityStore {
  // Refer to this class as EntityStore.Root outside this namespace.
  export class Root extends EntityStore {
    // Although each Root instance gets its own unique CacheGroup object,
    // any Layer instances created by calling addLayer need to share a
    // single distinct CacheGroup object. Since this shared object must
    // outlast the Layer instances themselves, it needs to be created and
    // owned by the Root instance.
    private sharedLayerGroup: CacheGroup = null;

    constructor({
      resultCaching = true,
      seed,
    }: {
      resultCaching?: boolean;
      seed?: NormalizedCacheObject;
    }) {
      super();
      (this.group as any) = new CacheGroup(resultCaching);
      this.sharedLayerGroup = new CacheGroup(resultCaching);
      if (seed) this.replace(seed);
    }

    public addLayer(
      layerId: string,
      replay: (layer: EntityStore) => any,
    ): EntityStore {
      // The replay function will be called in the Layer constructor.
      return new Layer(layerId, this, replay, this.sharedLayerGroup);
    }

    public removeLayer(layerId: string): Root {
      // Never remove the root layer.
      return this;
    }
  }
}

// Not exported, since all Layer instances are created by the addLayer method
// of the EntityStore.Root class.
class Layer extends EntityStore {
  constructor(
    public readonly id: string,
    public readonly parent: EntityStore,
    public readonly replay: (layer: EntityStore) => any,
    public readonly group: CacheGroup,
  ) {
    super();
    replay(this);
  }

  public addLayer(
    layerId: string,
    replay: (layer: EntityStore) => any,
  ): EntityStore {
    return new Layer(layerId, this, replay, this.group);
  }

  public removeLayer(layerId: string): EntityStore {
    // Remove all instances of the given id, not just the first one.
    const parent = this.parent.removeLayer(layerId);

    if (layerId === this.id) {
      // Dirty every ID we're removing.
      // TODO Some of these IDs could escape dirtying if value unchanged.
      if (this.group.caching) {
        Object.keys(this.data).forEach(dataId => this.delete(dataId));
      }
      return parent;
    }

    // No changes are necessary if the parent chain remains identical.
    if (parent === this.parent) return this;

    // Recreate this layer on top of the new parent.
    return parent.addLayer(this.id, this.replay);
  }

  public toObject(): NormalizedCacheObject {
    return {
      ...this.parent.toObject(),
      ...this.data,
    };
  }

  public findChildRefIds(dataId: string): Record<string, true> {
    const fromParent = this.parent.findChildRefIds(dataId);
    return hasOwn.call(this.data, dataId) ? {
      ...fromParent,
      ...super.findChildRefIds(dataId),
    } : fromParent;
  }
}

const storeObjectReconciler: ReconcilerFunction<[EntityStore]> = function (
  existingObject,
  incomingObject,
  property,
  // This parameter comes from the additional argument we pass to the
  // merge method in context.mergeStoreObjects (see writeQueryToStore).
  store,
) {
  // In the future, reconciliation logic may depend on the type of the parent
  // StoreObject, not just the values of the given property.
  const existing = existingObject[property];
  const incoming = incomingObject[property];

  if (
    existing !== incoming &&
    // The DeepMerger class has various helpful utilities that we might as
    // well reuse here.
    this.isObject(existing) &&
    this.isObject(incoming)
  ) {
    const eType = getTypenameFromStoreObject(store, existing);
    const iType = getTypenameFromStoreObject(store, incoming);
    // If both objects have a typename and the typename is different, let the
    // incoming object win. The typename can change when a different subtype
    // of a union or interface is written to the store.
    if (
      typeof eType === 'string' &&
      typeof iType === 'string' &&
      eType !== iType
    ) {
      return incoming;
    }

    invariant(
      !isReference(existing) || isReference(incoming),
      `Store error: the application attempted to write an object with no provided id but the store already contains an id of ${existing.__ref} for this object.`,
    );

    // It's worth checking deep equality here (even though blindly
    // returning incoming would be logically correct) because preserving
    // the referential identity of existing data can prevent needless
    // rereading and rerendering.
    if (equal(existing, incoming)) {
      return existing;
    }
  }

  // In all other cases, incoming replaces existing without any effort to
  // merge them deeply, since custom merge functions have already been
  // applied to the incoming data by walkWithMergeOverrides.
  return incoming;
}

export function supportsResultCaching(store: any): store is EntityStore {
  // When result caching is disabled, store.depend will be null.
  return !!(store instanceof EntityStore && store.group.caching);
}

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new EntityStore.Root({ resultCaching: true, seed });
}
