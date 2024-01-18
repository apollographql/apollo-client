export interface QueryOptionsDocumentation {
  /**
   * A GraphQL query string parsed into an AST with the gql template literal.
   *
   * @docGroup 1. Operation options
   */
  query: unknown;

  /**
   * An object containing all of the GraphQL variables your query requires to execute.
   *
   * Each key in the object corresponds to a variable name, and that key's value corresponds to the variable value.
   *
   * @docGroup 1. Operation options
   */
  variables: unknown;

  /**
   * Specifies how the query handles a response that returns both GraphQL errors and partial results.
   *
   * For details, see [GraphQL error policies](https://www.apollographql.com/docs/react/data/error-handling/#graphql-error-policies).
   *
   * The default value is `none`, meaning that the query result includes error details but not partial results.
   *
   * @docGroup 1. Operation options
   */
  errorPolicy: unknown;

  /**
   * If you're using [Apollo Link](https://www.apollographql.com/docs/react/api/link/introduction/), this object is the initial value of the `context` object that's passed along your link chain.
   *
   * @docGroup 2. Networking options
   */
  context: unknown;

  /**
   * Specifies how the query interacts with the Apollo Client cache during execution (for example, whether it checks the cache for results before sending a request to the server).
   *
   * For details, see [Setting a fetch policy](https://www.apollographql.com/docs/react/data/queries/#setting-a-fetch-policy).
   *
   * The default value is `cache-first`.
   *
   * @docGroup 3. Caching options
   */
  fetchPolicy: unknown;

  /**
   * Specifies the {@link FetchPolicy} to be used after this query has completed.
   *
   * @docGroup 3. Caching options
   */
  nextFetchPolicy: unknown;

  /**
   * Defaults to the initial value of options.fetchPolicy, but can be explicitly
   * configured to specify the WatchQueryFetchPolicy to revert back to whenever
   * variables change (unless nextFetchPolicy intervenes).
   *
   * @docGroup 3. Caching options
   */
  initialFetchPolicy: unknown;

  /**
   * Specifies the interval (in milliseconds) at which the query polls for updated results.
   *
   * The default value is `0` (no polling).
   *
   * @docGroup 2. Networking options
   */
  pollInterval: unknown;

  /**
   * If `true`, the in-progress query's associated component re-renders whenever the network status changes or a network error occurs.
   *
   * The default value is `false`.
   *
   * @docGroup 2. Networking options
   */
  notifyOnNetworkStatusChange: unknown;

  /**
   * If `true`, the query can return partial results from the cache if the cache doesn't contain results for all queried fields.
   *
   * The default value is `false`.
   *
   * @docGroup 3. Caching options
   */
  returnPartialData: unknown;

  /**
   * Specifies whether a {@link NetworkStatus.refetch} operation should merge
   * incoming field data with existing data, or overwrite the existing data.
   * Overwriting is probably preferable, but merging is currently the default
   * behavior, for backwards compatibility with Apollo Client 3.x.
   *
   * @docGroup 3. Caching options
   */
  refetchWritePolicy: unknown;

  /**
   * Watched queries must opt into overwriting existing data on refetch, by passing refetchWritePolicy: "overwrite" in their WatchQueryOptions.
   *
   * The default value is "overwrite".
   *
   * * @docGroup 3. Caching options
   */
  refetchWritePolicy_suspense: unknown;

  /**
   * If `true`, causes a query refetch if the query result is detected as partial.
   *
   * The default value is `false`.
   *
   * @deprecated
   * Setting this option is unnecessary in Apollo Client 3, thanks to a more consistent application of fetch policies. It might be removed in a future release.
   */
  partialRefetch: unknown;

  /**
   * Whether to canonize cache results before returning them. Canonization
   * takes some extra time, but it speeds up future deep equality comparisons.
   * Defaults to false.
   *
   * @deprecated
   * Using `canonizeResults` can result in memory leaks so we generally do not
   * recommend using this option anymore.
   * A future version of Apollo Client will contain a similar feature without
   * the risk of memory leaks.
   */
  canonizeResults: unknown;

  /**
   * If true, the query is not executed. **Not available with `useLazyQuery`**.
   *
   * The default value is `false`.
   *
   * @docGroup 1. Operation options
   */
  skip: unknown;

  /**
   * If `true`, the query is not executed. The default value is `false`.
   *
   * @deprecated We recommend using `skipToken` in place of the `skip` option as
   * it is more type-safe.
   *
   * This option is deprecated and only supported to ease the migration from useQuery. It will be removed in a future release.
   *
   * @docGroup 1. Operation options
   */
  skip_deprecated: unknown;

  /**
   * A callback function that's called when your query successfully completes with zero errors (or if `errorPolicy` is `ignore` and partial data is returned).
   *
   * This function is passed the query's result `data`.
   *
   * @docGroup 1. Operation options
   */
  onCompleted: unknown;
  /**
   * A callback function that's called when the query encounters one or more errors (unless `errorPolicy` is `ignore`).
   *
   * This function is passed an `ApolloError` object that contains either a `networkError` object or a `graphQLErrors` array, depending on the error(s) that occurred.
   *
   * @docGroup 1. Operation options
   */
  onError: unknown;

  /**
   * The instance of {@link ApolloClient} to use to execute the query.
   *
   * By default, the instance that's passed down via context is used, but you
   * can provide a different instance here.
   *
   * @docGroup 1. Operation options
   */
  client: unknown;

  /**
   * A unique identifier for the query. Each item in the array must be a stable
   * identifier to prevent infinite fetches.
   *
   * This is useful when using the same query and variables combination in more
   * than one component, otherwise the components may clobber each other. This
   * can also be used to force the query to re-evaluate fresh.
   *
   * @docGroup 1. Operation options
   */
  queryKey: unknown;

  /**
   * Pass `false` to skip executing the query during [server-side rendering](https://www.apollographql.com/docs/react/performance/server-side-rendering/).
   *
   * @docGroup 2. Networking options
   */
  ssr: unknown;
}
