import type { DocumentNode } from "graphql";

export type CacheKey = [
  query: DocumentNode,
  stringifiedVariables: string,
  ...queryKey: any[],
];
