import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';
import { wrap, OptimisticWrapperFunction } from 'optimism';
import { isReference } from './helpers';

const hasOwn = Object.prototype.hasOwnProperty;

type DependType = OptimisticWrapperFunction<[string], StoreObject> | null;

export abstract class EntityCache implements NormalizedCache {
  protected data: NormalizedCacheObject = Object.create(null);

  // It seems like this property ought to be protected rather than public,
  // but TypeScript doesn't realize it's inherited from a shared base
  // class by both Root and Layer classes, so Layer methods are forbidden
  // from accessing the .depend property of an arbitrary EntityCache
  // instance, because it might be a Root instance (and vice-versa).
  public readonly depend: DependType = null;

  protected makeDepend(): DependType {
    // It's important for this.depend to return a real value instead of
    // void, because this.depend(dataId) after this.depend.dirty(dataId)
    // marks the ID as clean if the result has not changed since the last
    // time the parent computation called this.depend(dataId). Returning
    // the StoreObject ensures the ID stays dirty unless its StoreObject
    // value is actually === the same as before.
    return wrap((dataId: string) => this.data[dataId], {
      disposable: true,
      makeCacheKey(dataId) {
        return dataId;
      },
    });
  }

  public abstract addLayer(
    layerId: string,
    replay: (layer: EntityCache) => any,
  ): EntityCache;

  public abstract removeLayer(layerId: string): EntityCache;

  // Although the EntityCache class is abstract, it contains concrete
  // implementations of the various NormalizedCache interface methods that
  // are inherited by the Root and Layer subclasses.

  public toObject(): NormalizedCacheObject {
    return { ...this.data };
  }

  public get(dataId: string): StoreObject {
    if (this.depend) this.depend(dataId);
    return this.data[dataId]!;
  }

  public set(dataId: string, value: StoreObject): void {
    if (!hasOwn.call(this.data, dataId) || value !== this.data[dataId]) {
      this.data[dataId] = value;
      delete this.refs[dataId];
      if (this.depend) this.depend.dirty(dataId);
    }
  }

  public delete(dataId: string): void {
    if (this instanceof Layer) {
      this.data[dataId] = void 0;
    } else delete this.data[dataId];
    delete this.refs[dataId];
    if (this.depend) this.depend.dirty(dataId);
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
        this.set(dataId, newData[dataId]);
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
  // cache that are no longer reachable starting from any IDs that have been
  // explicitly retained (see retain and release, above). Returns an array of
  // dataId strings that were removed from the cache.
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
        // getting removed from the root cache layer below.
        delete snapshot[id];
      }
    });
    const idsToRemove = Object.keys(snapshot);
    if (idsToRemove.length) {
      let root: EntityCache = this;
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
      // Within the cache, only arrays and objects can contain child entity
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

export namespace EntityCache {
  // Refer to this class as EntityCache.Root outside this namespace.
  export class Root extends EntityCache {
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
        (this as any).depend = this.makeDepend();
        this.sharedLayerDepend = this.makeDepend();
      }
      if (seed) this.replace(seed);
    }

    public addLayer(
      layerId: string,
      replay: (layer: EntityCache) => any,
    ): EntityCache {
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
// of the EntityCache.Root class.
class Layer extends EntityCache {
  constructor(
    public readonly id: string,
    public readonly parent: Layer | EntityCache.Root,
    public readonly replay: (layer: EntityCache) => any,
    public readonly depend: DependType,
  ) {
    super();
    replay(this);
  }

  public addLayer(
    layerId: string,
    replay: (layer: EntityCache) => any,
  ): EntityCache {
    return new Layer(layerId, this, replay, this.depend);
  }

  public removeLayer(layerId: string): EntityCache {
    // Remove all instances of the given id, not just the first one.
    const parent = this.parent.removeLayer(layerId);

    if (layerId === this.id) {
      // Dirty every ID we're removing.
      // TODO Some of these IDs could escape dirtying if value unchanged.
      if (this.depend) {
        Object.keys(this.data).forEach(dataId => this.depend.dirty(dataId));
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

  // All the other inherited accessor methods work as-is, but the get method
  // needs to fall back to this.parent.get when accessing a missing dataId.
  public get(dataId: string): StoreObject {
    if (hasOwn.call(this.data, dataId)) {
      return super.get(dataId);
    }
    // If this layer has a this.depend function and it's not the one
    // this.parent is using, we need to depend on the given dataId before
    // delegating to the parent. This check saves us from calling
    // this.depend(dataId) for every optimistic layer we examine, but
    // ensures we call this.depend(dataId) in the last optimistic layer
    // before we reach the root layer.
    if (this.depend && this.depend !== this.parent.depend) {
      this.depend(dataId);
    }
    return this.parent.get(dataId);
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

export function supportsResultCaching(store: any): store is EntityCache {
  // When result caching is disabled, store.depend will be null.
  return !!(store instanceof EntityCache && store.depend);
}

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new EntityCache.Root({ resultCaching: true, seed });
}
