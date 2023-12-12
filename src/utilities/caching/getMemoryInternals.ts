import type { OptimisticWrapperFunction } from "optimism";
import type {
  InMemoryCache,
  DocumentTransform,
  ApolloLink,
  ApolloCache,
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

type RemoveThis<T> = T extends (this: any) => infer R ? () => R : never;

/**
 * For internal purposes only - please call `ApolloClient.getMemoryInternals` instead
 * @internal
 */
export const getApolloClientMemoryInternals =
  __DEV__ ?
    (_getApolloClientMemoryInternals as RemoveThis<
      typeof _getApolloClientMemoryInternals
    >)
  : undefined;

/**
 * For internal purposes only - please call `ApolloClient.getMemoryInternals` instead
 * @internal
 */
export const getInMemoryCacheMemoryInternals =
  __DEV__ ?
    (_getInMemoryCacheMemoryInternals as RemoveThis<
      typeof _getInMemoryCacheMemoryInternals
    >)
  : undefined;

/**
 * For internal purposes only - please call `ApolloClient.getMemoryInternals` instead
 * @internal
 */
export const getApolloCacheMemoryInternals =
  __DEV__ ?
    (_getApolloCacheMemoryInternals as RemoveThis<
      typeof _getApolloCacheMemoryInternals
    >)
  : undefined;

function _getApolloClientMemoryInternals(this: ApolloClient<any>) {
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
      cache: this.cache.getMemoryInternals?.(),
    },
  };
}

function _getApolloCacheMemoryInternals(this: ApolloCache<any>) {
  return {
    fragmentQueryDocuments: getWrapperInformation(this["getFragmentDoc"]),
  };
}

function _getInMemoryCacheMemoryInternals(this: InMemoryCache) {
  const fragments = this.config.fragments as
    | undefined
    | {
        findFragmentSpreads?: Function;
        transform?: Function;
        lookup?: Function;
      };

  return {
    ..._getApolloCacheMemoryInternals.apply(this as any),
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
      ].filter((x): x is number => x != null);
}

function linkInfo(link?: ApolloLink): unknown[] {
  return !link ?
      []
    : [
        link?.getMemoryInternals?.(),
        ...linkInfo(link?.left),
        ...linkInfo(link?.right),
      ].filter((x) => x != null);
}

// removeTypenameFromVariables getVariableDefinitions
