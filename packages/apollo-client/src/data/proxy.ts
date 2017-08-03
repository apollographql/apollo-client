import { DocumentNode } from 'graphql';

export interface DataProxyReadQueryOptions {
  /**
   * The GraphQL query shape to be used constructed using the `gql` template
   * string tag from `graphql-tag`. The query will be used to determine the
   * shape of the data to be read.
   */
  query: DocumentNode;

  /**
   * Any variables that the GraphQL query may depend on.
   */
  variables?: Object;
}

export interface DataProxyReadFragmentOptions {
  /**
   * The root id to be used. This id should take the same form as the
   * value returned by your `dataIdFromObject` function. If a value with your
   * id does not exist in the store, `null` will be returned.
   */
  id: string;

  /**
   * A GraphQL document created using the `gql` template string tag from
   * `graphql-tag` with one or more fragments which will be used to determine
   * the shape of data to read. If you provide more then one fragment in this
   * document then you must also specify `fragmentName` to select a single.
   */
  fragment: DocumentNode;

  /**
   * The name of the fragment in your GraphQL document to be used. If you do
   * not provide a `fragmentName` and there is only one fragment in your
   * `fragment` document then that fragment will be used.
   */
  fragmentName?: string;

  /**
   * Any variables that your GraphQL fragments depend on.
   */
  variables?: Object;
}

export interface DataProxyWriteQueryOptions {
  /**
   * The data you will be writing to the store.
   */
  data: any;

  /**
   * The GraphQL query shape to be used constructed using the `gql` template
   * string tag from `graphql-tag`. The query will be used to determine the
   * shape of the data to be written.
   */
  query: DocumentNode;

  /**
   * Any variables that the GraphQL query may depend on.
   */
  variables?: Object;
}

export interface DataProxyWriteFragmentOptions {
  /**
   * The data you will be writing to the store.
   */
  data: any;

  /**
   * The root id to be used. This id should take the same form as the  value
   * returned by your `dataIdFromObject` function.
   */
  id: string;

  /**
   * A GraphQL document created using the `gql` template string tag from
   * `graphql-tag` with one or more fragments which will be used to determine
   * the shape of data to write. If you provide more then one fragment in this
   * document then you must also specify `fragmentName` to select a single.
   */
  fragment: DocumentNode;

  /**
   * The name of the fragment in your GraphQL document to be used. If you do
   * not provide a `fragmentName` and there is only one fragment in your
   * `fragment` document then that fragment will be used.
   */
  fragmentName?: string;

  /**
   * Any variables that your GraphQL fragments depend on.
   */
  variables?: Object;
}

/**
 * A proxy to the normalized data living in our store. This interface allows a
 * user to read and write denormalized data which feels natural to the user
 * whilst in the background this data is being converted into the normalized
 * store format.
 */
export interface DataProxy {
  /**
   * Reads a GraphQL query from the root query id.
   */
  readQuery<QueryType>(options: DataProxyReadQueryOptions): QueryType;

  /**
   * Reads a GraphQL fragment from any arbitrary id. If there are more then
   * one fragments in the provided document then a `fragmentName` must be
   * provided to select the correct fragment.
   */
  readFragment<FragmentType>(
    options: DataProxyReadFragmentOptions,
  ): FragmentType | null;

  /**
   * Writes a GraphQL query to the root query id.
   */
  writeQuery(options: DataProxyWriteQueryOptions): void;

  /**
   * Writes a GraphQL fragment to any arbitrary id. If there are more then
   * one fragments in the provided document then a `fragmentName` must be
   * provided to select the correct fragment.
   */
  writeFragment(options: DataProxyWriteFragmentOptions): void;
}
