import type { DocumentNode } from "graphql";

export type CacheKey = [
  query: DocumentNode,
  stringifiedVariables: string,
  ...queryKey: any[],
];

export type FragmentCacheKey = [
  cacheId: string | Array<string | null>,
  fragment: DocumentNode,
  stringifiedVariables: string,
];

export interface QueryKey {
  __queryKey?: string;
}

export interface FragmentKey {
  __fragmentKey?: string;
}
