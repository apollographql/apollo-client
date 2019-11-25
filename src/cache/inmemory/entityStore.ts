import { dep, OptimisticDependencyFunction } from 'optimism';
import { invariant } from 'ts-invariant';
import { isReference, StoreValue } from '../../utilities/graphql/storeUtils';
import {
  DeepMerger,
  ReconcilerFunction,
} from '../../utilities/common/mergeDeep';
import { isEqual } from '../../utilities/common/isEqual';
import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';
import { getTypenameFromStoreObject } from './helpers';

const hasOwn = Object.prototype.hasOwnProperty;

type DependType = OptimisticDependencyFunction<string> | null;

function makeDepKey(dataId: string, fieldName?: string) {
  const parts = [dataId];
  if (typeof fieldName === "string") {
    parts.push(fieldName);
  }
  return JSON.stringify(parts);
}

function depend(store: EntityStore, dataId: string, fieldName?: string) {
  if (store.depend) {
    store.depend(makeDepKey(dataId, fieldName));
  }
}

function dirty(store: EntityStore, dataId: string, fieldName?: string) {
  if (store.depend) {
    store.depend.dirty(makeDepKey(dataId));
    if (typeof fieldName === "string") {
      store.depend.dirty(makeDepKey(dataId, fieldName));
    }
  }
}

export abstract class EntityStore implements NormalizedCache {
  protected data: NormalizedCacheObject = Object.create(null);

  // It seems like this property ought to be protected rather than public,
  // but TypeScript doesn't realize it's inherited from a shared base
  // class by both Root and Layer classes, so Layer methods are forbidden
  // from accessing the .depend property of an arbitrary EntityStore
  // instance, because it might be a Root instance (and vice-versa).
  public readonly depend: DependType = null;

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
    return this.get(dataId) !== void 0;
  }

  public get(dataId: string): StoreObject {
    depend(this, dataId);
    return this.data[dataId];
  }

  public getFieldValue(dataId: string, fieldName: string): StoreValue {
    depend(this, dataId, fieldName);
    const storeObject = this.data[dataId];
    return storeObject && storeObject[fieldName];
  }

  public merge(dataId: string, incoming: StoreObject): void {
    const existing = this.get(dataId);
    const merged = new DeepMerger(storeObjectReconciler)
      .merge(existing, incoming, this);
    if (merged !== existing) {
      this.data[dataId] = merged;
      delete this.refs[dataId];
      if (this.depend) {
        // First, invalidate any dependents that called get rather than
        // getFieldValue.
        dirty(this, dataId);
        // Now invalidate dependents who called getFieldValue for any
        // fields that are changing as a result of this merge.
        Object.keys(incoming).forEach(fieldName => {
          if (!existing || incoming[fieldName] !== existing[fieldName]) {
            dirty(this, dataId, fieldName);
          }
        });
      }
    }
  }

  // TODO Allow deleting fields of this.data[dataId] according to their
  // original field.name.value.
  public delete(dataId: string): void {
    const storeObject = this.data[dataId];

    delete this.data[dataId];
    delete this.refs[dataId];
    // Note that we do not delete the this.rootIds[dataId] retainment
    // count for this ID, since an object with the same ID could appear in
    // the store again, and should not have to be retained again.
    // delete this.rootIds[dataId];

    if (this.depend && storeObject) {
      dirty(this, dataId);
      Object.keys(storeObject).forEach(fieldName => {
        dirty(this, dataId, fieldName);
      });
    }
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

  // This method will be overridden in the Layer class to merge root IDs for all
  // layers (including the root).
  public getRootIdSet() {
    return new Set(Object.keys(this.rootIds));
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
      idsToRemove.forEach(root.delete, root);
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
}

export namespace EntityStore {
  // Refer to this class as EntityStore.Root outside this namespace.
  export class Root extends EntityStore {
    // Although each Root instance gets its own unique this.depend
    // function, any Layer instances created by calling addLayer need to
    // share a single distinct dependency function. Since this shared
    // function must outlast the Layer instances themselves, it needs to
    // be created and owned by the Root instance.
    private sharedLayerDepend: DependType = null;

    constructor({
      resultCaching = true,
      seed,
    }: {
      resultCaching?: boolean;
      seed?: NormalizedCacheObject;
    }) {
      super();
      if (resultCaching) {
        // Regard this.depend as publicly readonly but privately mutable.
        (this as any).depend = dep<string>();
        this.sharedLayerDepend = dep<string>();
      }
      if (seed) this.replace(seed);
    }

    public addLayer(
      layerId: string,
      replay: (layer: EntityStore) => any,
    ): EntityStore {
      // The replay function will be called in the Layer constructor.
      return new Layer(layerId, this, replay, this.sharedLayerDepend);
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
    public readonly parent: Layer | EntityStore.Root,
    public readonly replay: (layer: EntityStore) => any,
    public readonly depend: DependType,
  ) {
    super();
    replay(this);
  }

  public addLayer(
    layerId: string,
    replay: (layer: EntityStore) => any,
  ): EntityStore {
    return new Layer(layerId, this, replay, this.depend);
  }

  public removeLayer(layerId: string): EntityStore {
    // Remove all instances of the given id, not just the first one.
    const parent = this.parent.removeLayer(layerId);

    if (layerId === this.id) {
      // Dirty every ID we're removing.
      // TODO Some of these IDs could escape dirtying if value unchanged.
      if (this.depend) {
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

  public get(dataId: string): StoreObject {
    if (hasOwn.call(this.data, dataId)) {
      return super.get(dataId);
    }

    // If this layer has a this.depend function and it's not the one
    // this.parent is using, we need to depend on the given dataId using
    // this.depend before delegating to the parent. This check saves us
    // from calling this.depend for every optimistic layer we examine, but
    // ensures we call this.depend in the last optimistic layer before we
    // reach the root layer.
    if (this.depend && this.depend !== this.parent.depend) {
      depend(this, dataId);
    }

    return this.parent.get(dataId);
  }

  public getFieldValue(dataId: string, fieldName: string): StoreValue {
    if (hasOwn.call(this.data, dataId)) {
      const storeObject = this.data[dataId];
      if (storeObject && hasOwn.call(storeObject, fieldName)) {
        return super.getFieldValue(dataId, fieldName);
      }
    }

    if (this.depend && this.depend !== this.parent.depend) {
      depend(this, dataId, fieldName);
    }

    return this.parent.getFieldValue(dataId, fieldName);
  }

  public delete(dataId: string): void {
    super.delete(dataId);
    // In case this.parent (or one of its ancestors) has an entry for this ID,
    // we need to shadow it with an undefined value, or it might be inherited
    // by the Layer#get method.
    this.data[dataId] = void 0;
  }

  // Return a Set<string> of all the ID strings that have been retained by this
  // Layer *and* any layers/roots beneath it.
  public getRootIdSet(): Set<string> {
    const ids = this.parent.getRootIdSet();
    super.getRootIdSet().forEach(ids.add, ids);
    return ids;
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
    if (isEqual(existing, incoming)) {
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
  return !!(store instanceof EntityStore && store.depend);
}

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new EntityStore.Root({ resultCaching: true, seed });
}
