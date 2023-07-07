import type {
  ApolloClient,
  DocumentNode,
  OperationVariables,
} from '../../core/index.js';

interface ApolloCustomMatchers<R = void> {
  /**
   * Used to determine if two GraphQL query documents are equal to each other by
   * comparing their printed values. The document must be parsed by `gql`.
   */
  toMatchDocument(document: DocumentNode): R;

  /**
   * Used to determine if the Suspense cache has a cache entry.
   */
  toHaveSuspenseCacheEntryUsing(
    client: ApolloClient<unknown>,
    query: DocumentNode,
    options?: {
      variables?: OperationVariables;
      queryKey?: string | number | any[];
    }
  ): R;
}

declare global {
  namespace jest {
    interface Matchers<R = void> extends ApolloCustomMatchers<R> {}
  }
}
