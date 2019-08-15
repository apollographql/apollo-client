import { NormalizedCache, NormalizedCacheObject, StoreObject } from './types';
import { wrap, OptimisticWrapperFunction } from 'optimism';

const hasOwn = Object.prototype.hasOwnProperty;

type DependType = OptimisticWrapperFunction<[string], StoreObject> | null;

export abstract class DepTrackingCache implements NormalizedCache {
  protected data: NormalizedCacheObject = Object.create(null);
  public readonly depend: DependType = null;

  protected makeDepend(): DependType {
    return wrap((dataId: string) => this.data[dataId], {
      disposable: true,
      makeCacheKey(dataId) {
        return dataId;
      },
    });
  }

  public abstract addLayer(
    id: string,
    replay: (layer: DepTrackingCache) => any,
  ): DepTrackingCache;

  public abstract removeLayer(id: string): DepTrackingCache;

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

export namespace DepTrackingCache {
  // Refer to this class as DepTrackingCache.Root outside this namespace.
  export class Root extends DepTrackingCache {
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
        (this as any).depend = this.makeDepend();
        this.sharedLayerDepend = this.makeDepend();
      }
      if (seed) this.replace(seed);
    }

    public addLayer(
      id: string,
      replay: (layer: DepTrackingCache) => any,
    ): DepTrackingCache {
      return new Layer(id, this, replay, this.sharedLayerDepend);
    }

    public removeLayer(): Root {
      return this;
    }
  }
}

// Not exported, since all Layer instances are created by the addLayer method
// of the DepTrackingCache.Root class.
class Layer extends DepTrackingCache {
  constructor(
    private id: string,
    private parent: DepTrackingCache,
    private replay: (layer: DepTrackingCache) => any,
    public readonly depend: DependType,
  ) {
    super();
    replay(this);
  }

  public addLayer(
    id: string,
    replay: (layer: DepTrackingCache) => any,
  ): DepTrackingCache {
    return new Layer(id, this, replay, this.depend);
  }

  public removeLayer(id: string): DepTrackingCache {
    const parent = this.parent.removeLayer(id);
    if (id === this.id) {
      // Dirty every ID we're removing.
      // TODO Some of these IDs could escape dirtying if value unchanged.
      if (this.depend) {
        Object.keys(this.data).forEach(dataId => this.depend.dirty(dataId));
      }
      return parent;
    }
    if (parent === this.parent) return this;
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
    if (this.depend && this.depend !== this.parent.depend) {
      this.depend(dataId);
    }
    return this.parent.get(dataId);
  }
}

export function supportsResultCaching(store: any): store is DepTrackingCache {
  return !!(store instanceof DepTrackingCache && store.depend);
}

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  return new DepTrackingCache.Root({ resultCaching: true, seed });
}
