import type { OptimisticWrapperFunction } from "optimism";
import type {
  InMemoryCache,
  DocumentTransform,
  ApolloLink,
} from "../../core/index.js";
import type { ApolloClient } from "../../core/index.js";
import type { CacheSizes } from "./sizes.js";
import { cacheSizes } from "./sizes.js";

export type CacheStatus = {
  limits: CacheSizes;
  sizes: {
    [K in keyof CacheSizes]?: number | number[];
  } & {
    links?: number[];
  };
};

const globalCaches: {
  print?: () => number;
  parser?: () => number;
  canonicalStringify?: () => number;
} = {};

export function registerGlobalCache(
  name: keyof typeof globalCaches,
  getSize: () => number
) {
  globalCaches[name] = getSize;
}

/**
 * For internal purposes only - please call `ApolloClient.getCacheStatus` instead
 * @internal
 */
export const getApolloClientCacheStatus =
  __DEV__ ? _getApolloClientCacheStatus : undefined;

/**
 * For internal purposes only - please call `ApolloClient.getCacheStatus` instead
 * @internal
 */
export const getInMemoryCacheStatus =
  __DEV__ ? _getInMemoryCacheStatus : undefined;

function _getApolloClientCacheStatus(this: ApolloClient<any>) {
  if (!__DEV__) throw new Error("only supported in development mode");

  return {
    limits: cacheSizes,
    sizes: {
      global: {
        print: globalCaches.print?.(),
        parser: globalCaches.parser?.(),
        canonicalStringify: globalCaches.canonicalStringify?.(),
      },
      links: linkInfo(this.link),
      queryManager: {
        Transforms: this["queryManager"]["transformCache"].size,
        documentTransforms: transformInfo(
          this["queryManager"].documentTransform
        ),
      },
      cache: (this.cache as InMemoryCache).getCacheStatus?.(),
    },
  };
}

function _getInMemoryCacheStatus(this: InMemoryCache) {
  const fragments = this.config.fragments as
    | undefined
    | {
        findFragmentSpreads?: Function;
        transform?: Function;
        lookup?: Function;
      };

  return {
    addTypenameTransform: transformInfo(this["addTypenameTransform"]),
    storeReader: {
      executeSelectionSet: getWrapperInformation(
        this["storeReader"]["executeSelectionSet"]
      ),
      executeSubSelectedArray: getWrapperInformation(
        this["storeReader"]["executeSubSelectedArray"]
      ),
    },
    maybeBroadcastWatch: getWrapperInformation(this["maybeBroadcastWatch"]),
    fragmentRegistry: {
      findFragmentSpreads: getWrapperInformation(
        fragments?.findFragmentSpreads
      ),
      lookup: getWrapperInformation(fragments?.lookup),
      transform: getWrapperInformation(fragments?.transform),
    },
  };
}

function isWrapper(f?: Function): f is OptimisticWrapperFunction<any, any> {
  return !!f && "dirtyKey" in f;
}

function getWrapperInformation(f?: Function) {
  return isWrapper(f) ? f.size : undefined;
}

function transformInfo(transform?: DocumentTransform): number[] {
  return !transform ?
      []
    : [
        getWrapperInformation(transform?.["performWork"]),
        ...transformInfo(transform?.["left"]),
        ...transformInfo(transform?.["right"]),
      ].filter(Boolean as any as (x: any) => x is number);
}

function linkInfo(link?: ApolloLink): number[] {
  return !link ?
      []
    : [
        link?.cacheSize,
        ...linkInfo(link?.left),
        ...linkInfo(link?.right),
      ].filter(Boolean as any as (x: any) => x is number);
}
