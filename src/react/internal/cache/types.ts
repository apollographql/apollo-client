import type { DocumentNode } from "graphql";

export type CacheKey = [
  query: DocumentNode,
  stringifiedVariables: string,
  ...queryKey: any[],
];

export type FragmentCacheKey = [
  fragment: DocumentNode,
  stringifiedVariables: string,
  cacheId: string | null,
];

export interface QueryKey {
  __queryKey?: string;
}

export interface FragmentKey {
  __fragmentKey?: string;
}
