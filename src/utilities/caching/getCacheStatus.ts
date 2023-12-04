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

export type GetCacheStatus = (this: ApolloClient<any>) => CacheStatus;

/**
 * For internal purposes only - please call `ApolloClient.getCacheStatus` instead
 * @internal
 */
export const getCacheStatus: GetCacheStatus = function () {
  if (!__DEV__) throw new Error("only supported in development mode");
  const documentTransforms: Array<number> = [];
  if ("addTypenameTransform" in this.cache) {
    documentTransforms.push(
      ...transformInfo(
        (this.cache as any as InMemoryCache)["addTypenameTransform"]
      )
    );
  }
  documentTransforms.push(
    ...transformInfo(this["queryManager"].documentTransform)
  );

  const fragments = (this.cache as InMemoryCache)["config"].fragments as
    | undefined
    | {
        findFragmentSpreads?: Function;
        transform?: Function;
        lookup?: Function;
      };

  return {
    limits: cacheSizes,
    sizes: {
      print: globalCaches.print?.(),
      parser: globalCaches.parser?.(),
      canonicalStringify: globalCaches.canonicalStringify?.(),
      documentTransform: documentTransforms,
      links: linkInfo(this.link),
      queryManagerTransforms: this["queryManager"]["transformCache"].size,
      fragmentRegistryFindFragmentSpreads: getWrapperInformation(
        fragments?.findFragmentSpreads
      ),
      fragmentRegistryLookup: getWrapperInformation(fragments?.lookup),
      fragmentRegistryTransform: getWrapperInformation(fragments?.transform),
    },
  };
};

function isWrapper(f?: Function): f is OptimisticWrapperFunction<any, any> {
  return !!f && "dirtyKey" in f;
}

function getWrapperInformation(f?: Function) {
  return isWrapper(f) ? f.size : undefined;
}

function transformInfo(transform?: DocumentTransform): number[] {
  return [
    getWrapperInformation(transform?.["performWork"]),
    ...transformInfo(transform?.["left"]),
    ...transformInfo(transform?.["right"]),
  ].filter(Boolean as any as (x: any) => x is number);
}

function linkInfo(link?: ApolloLink & { cacheSize?: number }): number[] {
  return [
    link?.cacheSize,
    ...linkInfo(link?.left),
    ...linkInfo(link?.right),
  ].filter(Boolean as any as (x: any) => x is number);
}
