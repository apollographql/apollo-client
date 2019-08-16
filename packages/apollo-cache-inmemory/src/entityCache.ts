import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';
import { wrap, OptimisticWrapperFunction } from 'optimism';

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
    id: string,
    replay: (layer: EntityCache) => any,
  ): EntityCache;

  public abstract removeLayer(id: string): EntityCache;

  // Although the EntityCache class is abstract, it contains concrete
  // implementations of the various NormalizedCache interface methods that
  // are inherited by the Root and Layer subclasses.

  public toObject(): NormalizedCacheObject {
    return this.data;
  }

  public get(dataId: string): StoreObject {
    if (this.depend) this.depend(dataId);
    return this.data[dataId]!;
  }

  public set(dataId: string, value: StoreObject): void {
    if (!hasOwn.call(this.data, dataId) || value !== this.data[dataId]) {
      this.data[dataId] = value;
      if (this.depend) this.depend.dirty(dataId);
    }
  }

  public delete(dataId: string): void {
    this.data[dataId] = void 0;
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
      id: string,
      replay: (layer: EntityCache) => any,
    ): EntityCache {
      // The replay function will be called in the Layer constructor.
      return new Layer(id, this, replay, this.sharedLayerDepend);
    }

    public removeLayer(): Root {
      // Never remove the root layer.
      return this;
    }
  }
}

// Not exported, since all Layer instances are created by the addLayer method
// of the EntityCache.Root class.
class Layer extends EntityCache {
  constructor(
    private id: string,
    private parent: EntityCache,
    private replay: (layer: EntityCache) => any,
    public readonly depend: DependType,
  ) {
    super();
    replay(this);
  }

  public addLayer(
    id: string,
    replay: (layer: EntityCache) => any,
  ): EntityCache {
    return new Layer(id, this, replay, this.depend);
  }

  public removeLayer(id: string): EntityCache {
    // Remove all instances of the given id, not just the first one.
    const parent = this.parent.removeLayer(id);

    if (id === this.id) {
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
