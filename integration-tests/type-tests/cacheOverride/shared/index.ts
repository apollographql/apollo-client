import {
  ApolloCache,
  Cache,
  OperationVariables,
  Reference,
  Transaction,
} from "@apollo/client";
import { FragmentDefinitionNode, InlineFragmentNode } from "graphql";

export declare function test(description: string, fn: () => void): void;

export declare class TestCache extends ApolloCache {
  public read<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(query: Cache.ReadOptions<TData, TVariables>): TData | null;
  public write<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(write: Cache.WriteOptions<TData, TVariables>): Reference | undefined;
  public diff<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(query: Cache.DiffOptions<TData, TVariables>): Cache.DiffResult<TData>;
  public watch<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  >(watch: Cache.WatchOptions<TData, TVariables>): () => void;
  public reset(options?: Cache.ResetOptions): Promise<void>;
  public evict(options: Cache.EvictOptions): boolean;
  public restore(serializedState: unknown): this;
  public extract(optimistic?: boolean): unknown;
  public removeOptimistic(id: string): void;
  public fragmentMatches(
    fragment: InlineFragmentNode | FragmentDefinitionNode,
    typename: string
  ): boolean;
  public performTransaction(
    transaction: Transaction,
    optimisticId?: string | null
  ): void;

  // a custom method to structurally distinguish this cache
  // impl from base cache or InMemoryCache
  public testCacheOnly(): boolean;
}
