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

  /**
   * A callback function that's called whenever a refetch attempt occurs
   * while polling. If the function returns `true`, the refetch is
   * skipped and not reattempted until the next poll interval.
   */
  skipPollAttempt: unknown;
}

export interface MutationOptionsDocumentation {
  /**
   * A GraphQL document, often created with `gql` from the `graphql-tag`
   * package, that contains a single mutation inside of it.
   *
   * @docGroup 1. Operation options
   */
  mutation: unknown;

  /**
   * Provide `no-cache` if the mutation's result should _not_ be written to the Apollo Client cache.
   * The default value is `network-only` (which means the result _is_ written to the cache).
   * Unlike queries, mutations _do not_ support [fetch policies](/react/data/queries/#setting-a-fetch-policy) besides `network-only` and `no-cache`.
   *
   * @docGroup 3. Caching options
   */
  fetchPolicy: unknown;

  /**
   * To avoid retaining sensitive information from mutation root field
   * arguments, Apollo Client v3.4+ automatically clears any `ROOT_MUTATION`
   * fields from the cache after each mutation finishes. If you need this
   * information to remain in the cache, you can prevent the removal by passing
   * `keepRootFields: true` to the mutation. `ROOT_MUTATION` result data are
   * also passed to the mutation `update` function, so we recommend obtaining
   * the results that way, rather than using this option, if possible.
   */
  keepRootFields: unknown;

  /**
   * By providing either an object or a callback function that, when invoked after
   * a mutation, allows you to return optimistic data and optionally skip updates
   * via the `IGNORE` sentinel object, Apollo Client caches this temporary
   * (and potentially incorrect) response until the mutation completes, enabling
   * more responsive UI updates.
   *
   * For more information, see [Optimistic mutation results](/react/performance/optimistic-ui/).
   *
   * @docGroup 3. Caching options
   */
  optimisticResponse: unknown;

  /**
   * A {@link MutationQueryReducersMap}, which is map from query names to
   * mutation query reducers. Briefly, this map defines how to incorporate the
   * results of the mutation into the results of queries that are currently
   * being watched by your application.
   */
  updateQueries: unknown;

  /**
   * An array (or a function that _returns_ an array) that specifies which queries you want to refetch after the mutation occurs.
   *
   * Each array value can be either:
   *
   * - An object containing the `query` to execute, along with any `variables`
   *
   * - A string indicating the operation name of the query to refetch
   *
   * @docGroup 1. Operation options
   */
  refetchQueries: unknown;

  /**
   * If `true`, makes sure all queries included in `refetchQueries` are completed before the mutation is considered complete.
   *
   * The default value is `false` (queries are refetched asynchronously).
   *
   * @docGroup 1. Operation options
   */
  awaitRefetchQueries: unknown;

  /**
   * A function used to update the Apollo Client cache after the mutation completes.
   *
   * For more information, see [Updating the cache after a mutation](/react/data/mutations#updating-the-cache-after-a-mutation).
   *
   * @docGroup 3. Caching options
   */
  update: unknown;

  /**
   * Optional callback for intercepting queries whose cache data has been updated by the mutation, as well as any queries specified in the [`refetchQueries: [...]`](#refetchQueries) list passed to `client.mutate`.
   *
   * Returning a `Promise` from `onQueryUpdated` will cause the final mutation `Promise` to await the returned `Promise`. Returning `false` causes the query to be ignored.
   *
   * @docGroup 1. Operation options
   */
  onQueryUpdated: unknown;

  /**
   * Specifies how the mutation handles a response that returns both GraphQL errors and partial results.
   *
   * For details, see [GraphQL error policies](/react/data/error-handling/#graphql-error-policies).
   *
   * The default value is `none`, meaning that the mutation result includes error details but _not_ partial results.
   *
   * @docGroup 1. Operation options
   */
  errorPolicy: unknown;

  /**
   * An object containing all of the GraphQL variables your mutation requires to execute.
   *
   * Each key in the object corresponds to a variable name, and that key's value corresponds to the variable value.
   *
   * @docGroup 1. Operation options
   */
  variables: unknown;

  /**
   * If you're using [Apollo Link](/react/api/link/introduction/), this object is the initial value of the `context` object that's passed along your link chain.
   *
   * @docGroup 2. Networking options
   */
  context: unknown;

  /**
   * The instance of `ApolloClient` to use to execute the mutation.
   *
   * By default, the instance that's passed down via context is used, but you can provide a different instance here.
   *
   * @docGroup 2. Networking options
   */
  client: unknown;
  /**
   * If `true`, the in-progress mutation's associated component re-renders whenever the network status changes or a network error occurs.
   *
   * The default value is `false`.
   *
   * @docGroup 2. Networking options
   */
  notifyOnNetworkStatusChange: unknown;
  /**
   * A callback function that's called when your mutation successfully completes with zero errors (or if `errorPolicy` is `ignore` and partial data is returned).
   *
   * This function is passed the mutation's result `data` and any options passed to the mutation.
   *
   * @docGroup 1. Operation options
   */
  onCompleted: unknown;
  /**
   * A callback function that's called when the mutation encounters one or more errors (unless `errorPolicy` is `ignore`).
   *
   * This function is passed an [`ApolloError`](https://github.com/apollographql/apollo-client/blob/d96f4578f89b933c281bb775a39503f6cdb59ee8/src/errors/index.ts#L36-L39) object that contains either a `networkError` object or a `graphQLErrors` array, depending on the error(s) that occurred, as well as any options passed the mutation.
   *
   * @docGroup 1. Operation options
   */
  onError: unknown;
  /**
   * If `true`, the mutation's `data` property is not updated with the mutation's result.
   *
   * The default value is `false`.
   *
   * @docGroup 1. Operation options
   */
  ignoreResults: unknown;
}

export interface SubscriptionOptionsDocumentation {
  /**
   * A GraphQL document, often created with `gql` from the `graphql-tag`
   * package, that contains a single subscription inside of it.
   */
  query: unknown;
  /**
   * An object containing all of the variables your subscription needs to execute
   *
   * @docGroup 1. Operation options
   */
  variables: unknown;

  /**
   * Specifies the {@link ErrorPolicy} to be used for this operation
   */
  errorPolicy: unknown;

  /**
   * How you want your component to interact with the Apollo cache. For details, see [Setting a fetch policy](/react/data/queries/#setting-a-fetch-policy).
   */
  fetchPolicy: unknown;

  /**
   * Determines if your subscription should be unsubscribed and subscribed again when an input to the hook (such as `subscription` or `variables`) changes.
   */
  shouldResubscribe: unknown;

  /**
   * An `ApolloClient` instance. By default `useSubscription` / `Subscription` uses the client passed down via context, but a different client can be passed in.
   */
  client: unknown;

  /**
   * Determines if the current subscription should be skipped. Useful if, for example, variables depend on previous queries and are not ready yet.
   */
  skip: unknown;

  /**
   * Shared context between your component and your network interface (Apollo Link).
   */
  context: unknown;

  /**
   * Allows the registration of a callback function that will be triggered each time the `useSubscription` Hook / `Subscription` component completes the subscription.
   *
   * @since 3.7.0
   */
  onComplete: unknown;

  /**
   * Allows the registration of a callback function that will be triggered each time the `useSubscription` Hook / `Subscription` component receives data. The callback `options` object param consists of the current Apollo Client instance in `client`, and the received subscription data in `data`.
   *
   * @since 3.7.0
   */
  onData: unknown;

  /**
   * Allows the registration of a callback function that will be triggered each time the `useSubscription` Hook / `Subscription` component receives data. The callback `options` object param consists of the current Apollo Client instance in `client`, and the received subscription data in `subscriptionData`.
   *
   * @deprecated Use onData instead
   */
  onSubscriptionData: unknown;

  /**
   * Allows the registration of a callback function that will be triggered each time the `useSubscription` Hook / `Subscription` component receives an error.
   *
   * @since 3.7.0
   */
  onError: unknown;

  /**
   * Allows the registration of a callback function that will be triggered when the `useSubscription` Hook / `Subscription` component completes the subscription.
   *
   * @deprecated Use onComplete instead
   */
  onSubscriptionComplete: unknown;
}
