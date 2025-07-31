// {
//   // completely removed in AC4
//   from: { module: "@apollo/client/react/components" },
// },
// {
//   // completely removed in AC4
//   from: { module: "@apollo/client/react/hoc" },
// },
// {
//   // completely removed in AC4
//   from: { module: "@apollo/client/react/components" },
// },
// {
//   // completely removed in AC4
//   from: { module: "@apollo/client/react/parser" },
// },
// {
//   // completely removed in AC4
//   from: { module: "@apollo/client/testing/experimental" },
// },
// {
//   // completely removed in AC4
//   from: { module: "@apollo/client/utilities/globals" },
// },
// {
//   // completely removed in AC4
//   from: { module: "@apollo/client/utilities/subscriptions/urql" },
// },

export const renames: Array<IdentifierRename | ModuleRename> = [
  {
    from: {
      module: "@apollo/client/core",
    },
    to: {
      module: "@apollo/client",
    },
  },
  {
    from: {
      module: "@apollo/client/link/core",
    },
    to: {
      module: "@apollo/client/link",
    },
  },
  {
    from: {
      module: "@apollo/client/react/context",
    },
    to: {
      module: "@apollo/client/react",
    },
  },
  {
    from: {
      module: "@apollo/client/react/hooks",
    },
    to: {
      module: "@apollo/client/react",
    },
  },
  {
    from: {
      module: "@apollo/client/testing/core",
    },
    to: {
      module: "@apollo/client/testing",
    },
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "ApolloConsumer",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "ApolloProvider",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "createQueryPreloader",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "getApolloContext",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "skipToken",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useApolloClient",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useBackgroundQuery",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useFragment",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useLazyQuery",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useLoadableQuery",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useMutation",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useQuery",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useQueryRefHandlers",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useReactiveVar",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useReadQuery",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useSubscription",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useSuspenseFragment",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "useSuspenseQuery",
    },
    to: {
      module: "@apollo/client/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "ApolloClientOptions",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "ApolloQueryResult",
    },
    to: {
      namespace: "ObservableQuery",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/link",
      identifier: "concat",
    },
    to: {
      alternativeModules: ["@apollo/client"],
      namespace: "ApolloLink",
      identifier: "from",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "DefaultOptions",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "DefaultOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "DevtoolsOptions",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "DevtoolsOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/link",
      identifier: "empty",
    },
    to: {
      alternativeModules: ["@apollo/client"],
      namespace: "ApolloLink",
      identifier: "empty",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client/link",
      identifier: "from",
    },
    to: {
      alternativeModules: ["@apollo/client"],
      namespace: "ApolloLink",
      identifier: "from",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client/testing",
      identifier: "MockedProvider",
    },
    to: {
      module: "@apollo/client/testing",
      identifier: "MockedProvider",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "MutateResult",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "MutateResult",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "MutationOptions",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "MutateOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "QueryOptions",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "QueryOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "RefetchQueriesOptions",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "RefetchQueriesOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "RefetchQueriesResult",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "RefetchQueriesResult",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/link",
      identifier: "split",
    },
    to: {
      alternativeModules: ["@apollo/client"],
      namespace: "ApolloLink",
      identifier: "split",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "SubscribeToMoreOptions",
    },
    to: {
      namespace: "ObservableQuery",
      identifier: "SubscribeToMoreOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "SubscriptionOptions",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "SubscribeOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client",
      identifier: "WatchQueryOptions",
    },
    to: {
      namespace: "ApolloClient",
      identifier: "WatchQueryOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/cache",
      identifier: "WatchFragmentOptions",
    },
    to: {
      namespace: "ApolloCache",
      identifier: "WatchFragmentOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/cache",
      identifier: "WatchFragmentResult",
    },
    to: {
      namespace: "ApolloCache",
      identifier: "WatchFragmentResult",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/link",
      identifier: "FetchResult",
    },
    to: {
      alternativeModules: ["@apollo/client"],
      namespace: "ApolloLink",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/link",
      identifier: "GraphQLRequest",
    },
    to: {
      namespace: "ApolloLink",
      identifier: "Request",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/link",
      identifier: "Operation",
    },
    to: {
      namespace: "ApolloLink",
      identifier: "Operation",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/link",
      identifier: "RequestHandler",
    },
    to: {
      namespace: "ApolloLink",
      identifier: "RequestHandler",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "BackgroundQueryHookFetchPolicy",
    },
    to: {
      namespace: "useBackgroundQuery",
      identifier: "FetchPolicy",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "BackgroundQueryHookOptions",
    },
    to: {
      namespace: "useBackgroundQuery",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "LazyQueryExecFunction",
    },
    to: {
      namespace: "useLazyQuery",
      identifier: "ExecOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "LazyQueryHookExecOptions",
    },
    to: {
      namespace: "useLazyQuery",
      identifier: "ExecOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "LazyQueryHookOptions",
    },
    to: {
      namespace: "useLazyQuery",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "LazyQueryResult",
    },
    to: {
      namespace: "useLazyQuery",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "LazyQueryResultTuple",
    },
    to: {
      namespace: "useLazyQuery",
      identifier: "ResultTuple",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "LoadableQueryFetchPolicy",
    },
    to: {
      namespace: "useLoadableQuery",
      identifier: "FetchPolicy",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "LoadableQueryHookOptions",
    },
    to: {
      namespace: "useLoadableQuery",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "LoadQueryFunction",
    },
    to: {
      namespace: "useLoadableQuery",
      identifier: "LoadQueryFunction",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "MutationFunctionOptions",
    },
    to: {
      namespace: "useMutation",
      identifier: "MutationFunctionOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "MutationHookOptions",
    },
    to: {
      namespace: "useMutation",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "MutationResult",
    },
    to: {
      namespace: "useMutation",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "MutationTuple",
    },
    to: {
      namespace: "useMutation",
      identifier: "ResultTuple",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "OnDataOptions",
    },
    to: {
      namespace: "useSubscription",
      identifier: "OnDataOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "OnSubscriptionDataOptions",
    },
    to: {
      namespace: "useSubscription",
      identifier: "OnSubscriptionDataOptions",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "QueryHookOptions",
    },
    to: {
      namespace: "useQuery",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "QueryResult",
    },
    to: {
      namespace: "useQuery",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "SubscriptionHookOptions",
    },
    to: {
      namespace: "useSubscription",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "SubscriptionResult",
    },
    to: {
      namespace: "useSubscription",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "SuspenseQueryHookFetchPolicy",
    },
    to: {
      namespace: "useSuspenseQuery",
      identifier: "FetchPolicy",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "SuspenseQueryHookOptions",
    },
    to: {
      namespace: "useSuspenseQuery",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseBackgroundQueryResult",
    },
    to: {
      namespace: "useBackgroundQuery",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseFragmentOptions",
    },
    to: {
      namespace: "useFragment",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseFragmentResult",
    },
    to: {
      namespace: "useFragment",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseLoadableQueryResult",
    },
    to: {
      namespace: "useLoadableQuery",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseQueryRefHandlersResult",
    },
    to: {
      namespace: "useQueryRefHandlers",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseReadQueryResult",
    },
    to: {
      namespace: "useReadQuery",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseSuspenseFragmentOptions",
    },
    to: {
      namespace: "useSuspenseFragment",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseSuspenseFragmentResult",
    },
    to: {
      namespace: "useSuspenseFragment",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/react",
      identifier: "UseSuspenseQueryResult",
    },
    to: {
      namespace: "useSuspenseQuery",
      identifier: "Result",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/testing",
      identifier: "MockedRequest",
    },
    to: {
      namespace: "MockLink",
      identifier: "MockedRequest",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/testing",
      identifier: "MockedResponse",
    },
    to: {
      namespace: "MockLink",
      identifier: "MockedResponse",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/testing",
      identifier: "MockLinkOptions",
    },
    to: {
      namespace: "MockLink",
      identifier: "Options",
    },
    importType: "type",
  },
  {
    from: {
      module: "@apollo/client/testing",
      identifier: "ResultFunction",
    },
    to: {
      namespace: "MockLink",
      identifier: "ResultFunction",
    },
    importType: "type",
  },
];

// Function to class transformations that require special handling
export const functionToClassTransforms: IdentifierRename[] = [
  {
    from: { module: "@apollo/client/link/error", identifier: "onError" },
    to: { identifier: "ErrorLink" },
    importType: "value",
  },
  {
    from: { module: "@apollo/client/link/context", identifier: "setContext" },
    to: { identifier: "SetContextLink" },
    importType: "value",
    // Note: setContext arguments are flipped compared to SetContextLink
  },
  {
    from: {
      module: "@apollo/client/link/persisted-queries",
      identifier: "createPersistedQueryLink",
    },
    to: { identifier: "PersistedQueryLink" },
    importType: "value",
  },
  {
    from: { module: "@apollo/client/link/http", identifier: "createHttpLink" },
    to: { identifier: "HttpLink" },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client/link/remove-typename",
      identifier: "removeTypenameFromVariables",
    },
    to: { identifier: "RemoveTypenameFromVariablesLink" },
    importType: "value",
  },
  // no direct 1:1 drop-in replacement
  // {
  //   from: { module: "@apollo/client/react/ssr", identifier: "renderToStringWithData" },
  //   to: {
  //     module: "@apollo/client/react/ssr",
  //     identifier: "prerenderStatic",
  //   },
  //   realm: "runtime",
  // },
  // {
  //   from: { module: "@apollo/client/react/ssr", identifier: "getDataFromTree" },
  //   to: {
  //     module: "@apollo/client/react/ssr",
  //     identifier: "prerenderStatic",
  //   },
  //   realm: "runtime",
  // },
  // {
  //   from: { module: "@apollo/client/react/ssr", identifier: "getMarkupFromTree" },
  //   to: {
  //     module: "@apollo/client/react/ssr",
  //     identifier: "prerenderStatic",
  //   },
  //   realm: "runtime",
  // },
];

export interface IdentifierRename {
  from: {
    /** A list of source modules to look out for. */
    module: string;
    /** Alternative modules that should also be rewritten if encountered */
    alternativeModules?: string[];
    /** The identifier to be renamed or moved into another module/namespace. */
    identifier: string;
    /** If omitted, the source is not namespaced. */
    namespace?: string;
  };
  to: {
    /** If omitted, identifier was renamed within the same entry point. */
    module?: string;
    /**
     * A list of alternative valid entry points.
     * If one of these is already used, but `to.module` is not used in the file yet,
     * the alternative module will be used instead of adding a new `import` statement.
     */
    alternativeModules?: string[];
    /** If omitted, the identifier did not change. */
    identifier?: string;
    /** If omitted, the target is not namespaced. */
    namespace?: string;
  };
  importType: "type" | "value";
}

export interface ModuleRename {
  from: {
    module: string;
    identifier?: never;
    namespace?: never;
  };
  to: {
    module: string;
    identifier?: never;
    namespace?: never;
  };
}
