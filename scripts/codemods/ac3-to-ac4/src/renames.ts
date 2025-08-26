import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift";

import type { UtilContext } from "./types.js";
import { reorderGenericArguments } from "./util/reorderGenericArguments.js";
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
    from: { module: "@apollo/client/core" },
    to: { module: "@apollo/client" },
  },
  {
    from: { module: "@apollo/client/link/core" },
    to: { module: "@apollo/client/link" },
  },
  {
    from: { module: "@apollo/client/react/context" },
    to: { module: "@apollo/client/react" },
  },
  {
    from: { module: "@apollo/client/react/hooks" },
    to: { module: "@apollo/client/react" },
  },
  {
    from: { module: "@apollo/client/testing/core" },
    to: { module: "@apollo/client/testing" },
  },
  {
    from: {
      module: "@apollo/client/react",
      alternativeModules: ["@apollo/client", "@apollo/client/react/internal"],
      identifier: "QueryReference",
    },
    to: {
      module: "@apollo/client/react",
      alternativeModules: [],
      identifier: "QueryRef",
    },
    importType: "type",
  },
  ...[
    // were re-exported from the `@apollo/client/react` entry point
    { from: "ApolloProvider" },
    { from: "createQueryPreloader" },
    { from: "getApolloContext" },
    { from: "skipToken" },
    { from: "useApolloClient" },
    { from: "useBackgroundQuery" },
    { from: "useFragment" },
    { from: "useLazyQuery" },
    { from: "useLoadableQuery" },
    { from: "useMutation" },
    { from: "useQuery" },
    { from: "useQueryRefHandlers" },
    { from: "useReactiveVar" },
    { from: "useReadQuery" },
    { from: "useSubscription" },
    { from: "useSuspenseFragment" },
    { from: "useSuspenseQuery" },
  ].map(
    moveInto({
      from: { module: "@apollo/client" },
      to: { module: "@apollo/client/react" },
      importType: "value",
    })
  ),
  ...[
    // were re-exported from the `@apollo/client/react` entry point
    { from: "ApolloContextValue" },
    { from: "BackgroundQueryHookFetchPolicy" },
    { from: "BackgroundQueryHookOptions" },
    { from: "BaseSubscriptionOptions" },
    { from: "Context" },
    { from: "LazyQueryExecFunction" },
    { from: "LazyQueryHookExecOptions" },
    { from: "LazyQueryHookOptions" },
    { from: "LazyQueryResult" },
    { from: "LazyQueryResultTuple" },
    { from: "LoadableQueryHookFetchPolicy" },
    { from: "LoadableQueryHookOptions" },
    { from: "LoadQueryFunction" },
    { from: "MutationFunction" },
    { from: "MutationFunctionOptions" },
    { from: "MutationHookOptions" },
    { from: "MutationResult" },
    { from: "MutationTuple" },
    { from: "NoInfer" },
    { from: "OnDataOptions" },
    { from: "OnSubscriptionDataOptions" },
    { from: "PreloadedQueryRef" },
    { from: "PreloadQueryFetchPolicy" },
    { from: "PreloadQueryFunction" },
    { from: "PreloadQueryOptions" },
    { from: "QueryFunctionOptions" },
    { from: "QueryHookOptions" },
    { from: "QueryRef" },
    { from: "QueryReference" },
    { from: "QueryResult" },
    { from: "QueryTuple" },
    { from: "SkipToken" },
    { from: "SubscriptionDataOptions" },
    { from: "SubscriptionHookOptions" },
    { from: "SubscriptionResult" },
    { from: "SuspenseQueryHookFetchPolicy" },
    { from: "SuspenseQueryHookOptions" },
    { from: "UseBackgroundQueryResult" },
    { from: "UseFragmentOptions" },
    { from: "UseFragmentResult" },
    { from: "UseLoadableQueryResult" },
    { from: "UseQueryRefHandlersResult" },
    { from: "UseReadQueryResult" },
    { from: "UseSuspenseFragmentOptions" },
    { from: "UseSuspenseFragmentResult" },
    { from: "UseSuspenseQueryResult" },
    { from: "VariablesOption" },
  ].map(
    moveInto({
      from: { module: "@apollo/client" },
      to: { module: "@apollo/client/react" },
      importType: "type",
    })
  ),
  ...[
    // move to the `@apollo/client/react` entry point
    { from: "PreloadedQueryRef" },
    { from: "QueryRef" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/react/internal" },
      to: { module: "@apollo/client/react" },
      importType: "type",
    })
  ),
  ...[
    // move to the `@apollo/client/utilities/internal` entry point
    { from: "argumentsObjectFromField" },
    { from: "AutoCleanedStrongCache" },
    { from: "AutoCleanedWeakCache" },
    { from: "canUseDOM" },
    { from: "checkDocument" },
    { from: "cloneDeep" },
    { from: "compact" },
    { from: "createFragmentMap" },
    { from: "createFulfilledPromise" },
    { from: "createRejectedPromise" },
    { from: "dealias" },
    { from: "decoratePromise" },
    { from: "DeepMerger" },
    { from: "filterMap" },
    { from: "getApolloCacheMemoryInternals" },
    { from: "getApolloClientMemoryInternals" },
    { from: "getDefaultValues" },
    { from: "getFragmentDefinition" },
    { from: "getFragmentDefinitions" },
    { from: "getFragmentFromSelection" },
    { from: "getFragmentQueryDocument" },
    { from: "getGraphQLErrorsFromResult" },
    { from: "getInMemoryCacheMemoryInternals" },
    { from: "getOperationDefinition" },
    { from: "getOperationName" },
    { from: "getQueryDefinition" },
    { from: "getStoreKeyName" },
    { from: "graphQLResultHasError" },
    { from: "hasDirectives" },
    { from: "hasForcedResolvers" },
    { from: "isArray" },
    { from: "isDocumentNode" },
    { from: "isField" },
    { from: "isNonEmptyArray" },
    { from: "isNonNullObject" },
    { from: "isPlainObject" },
    { from: "makeReference" },
    { from: "makeUniqueId" },
    { from: "maybeDeepFreeze" },
    { from: "mergeDeep" },
    { from: "mergeDeepArray" },
    { from: "mergeOptions" },
    { from: "omitDeep" },
    { from: "preventUnhandledRejection" },
    { from: "registerGlobalCache" },
    { from: "removeDirectivesFromDocument" },
    { from: "resultKeyNameFromField" },
    { from: "shouldInclude" },
    { from: "storeKeyNameFromField" },
    { from: "stringifyForDisplay" },
    { from: "toQueryResult" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/utilities",
        alternativeModules: [
          // mergeOptions, makeReference
          "@apollo/client",
          // makeReference
          "@apollo/client/cache",
        ],
      },
      to: { module: "@apollo/client/utilities/internal" },
      importType: "value",
    })
  ),
  ...[
    // move to the `@apollo/client/utilities/internal` entry point
    { from: "DecoratedPromise" },
    { from: "DeepOmit" },
    { from: "FragmentMap" },
    { from: "FragmentMapFunction" },
    { from: "FulfilledPromise" },
    { from: "IsAny" },
    { from: "NoInfer" },
    { from: "PendingPromise" },
    { from: "Prettify" },
    { from: "Primitive" },
    { from: "RejectedPromise" },
    { from: "RemoveIndexSignature" },
    { from: "VariablesOption" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/utilities" },
      to: { module: "@apollo/client/utilities/internal" },
      importType: "type",
    })
  ),
  ...[{ from: "NoInfer" }, { from: "VariablesOption" }].map(
    moveInto({
      from: { module: "@apollo/client/react" },
      to: { module: "@apollo/client/utilities/internal" },
      importType: "type",
    })
  ),
  ...[{ from: "DEV", to: "__DEV__" }, { from: "__DEV__" }].map(
    moveInto({
      from: {
        module: "@apollo/client/utilities/global",
        alternativeModules: ["@apollo/client/utilities"],
      },
      to: { module: "@apollo/client/utilities/environment" },
      importType: "value",
    })
  ),
  ...[{ from: "global" }, { from: "maybe" }].map(
    moveInto({
      from: {
        module: "@apollo/client/utilities/global",
        alternativeModules: ["@apollo/client/utilities"],
      },
      to: { module: "@apollo/client/utilities/internal/globals" },
      importType: "value",
    })
  ),
  ...[
    { from: "invariant" },
    { from: "InvariantError" },
    { from: "newInvariantError" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/utilities/global" },
      to: { module: "@apollo/client/utilities/invariant" },
      importType: "value",
    })
  ),
  ...[
    // move into `ApolloClient` type namespace
    { from: "ApolloClientOptions", to: "Options" },
    { from: "DefaultOptions" },
    { from: "DevtoolsOptions" },
    { from: "MutateResult" },
    { from: "MutationOptions", to: "MutateOptions" },
    { from: "QueryOptions", postProcess: reorderGenerics([1, 0]) },
    { from: "RefetchQueriesOptions" },
    { from: "RefetchQueriesResult" },
    {
      from: "SubscriptionOptions",
      to: "SubscribeOptions",
      postProcess: reorderGenerics([1, 0]),
    },
    { from: "WatchQueryOptions", postProcess: reorderGenerics([1, 0]) },
  ].map(
    moveInto({
      from: { module: "@apollo/client" },
      to: { namespace: "ApolloClient" },
      importType: "type",
    })
  ),
  ...[
    // move into `ObservableQuery` type namespace
    { from: "ApolloQueryResult", to: "Result" },
    { from: "FetchMoreOptions" },
    { from: "SubscribeToMoreOptions" },
  ].map(
    moveInto({
      from: { module: "@apollo/client" },
      to: { namespace: "ObservableQuery" },
      importType: "type",
    })
  ),
  ...[
    // move into `ApolloCache` type namespace
    { from: "WatchFragmentOptions" },
    { from: "WatchFragmentResult" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/cache" },
      to: { namespace: "ApolloCache" },
      importType: "type",
    })
  ),
  ...[{ from: "Context", to: "DefaultContext" }].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
      },
      to: { module: "@apollo/client" },
      importType: "type",
    })
  ),
  ...[{ from: "ApolloProviderProps", to: "Props" }].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "ApolloProvider", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    { from: "BackgroundQueryHookFetchPolicy", to: "FetchPolicy" },
    {
      from: "BackgroundQueryHookOptions",
      to: "Options",
      postProcess: reorderGenerics([1]),
    },
    { from: "UseBackgroundQueryResult", to: "Result" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useBackgroundQuery", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    { from: "LazyQueryExecFunction", to: "ExecFunction" },
    { from: "LazyQueryHookExecOptions", to: "ExecOptions" },
    { from: "LazyQueryHookOptions", to: "Options" },
    { from: "LazyQueryResult", to: "Result" },
    { from: "LazyQueryResultTuple", to: "ResultTuple" },
    { from: "QueryTuple", to: "ResultTuple" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useLazyQuery", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    { from: "LoadableQueryFetchPolicy", to: "FetchPolicy" },
    { from: "LoadableQueryHookFetchPolicy", to: "FetchPolicy" },
    { from: "LoadableQueryHookOptions", to: "Options" },
    { from: "LoadQueryFunction" },
    { from: "UseLoadableQueryResult", to: "Result" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useLoadableQuery", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    {
      from: "MutationFunctionOptions",
      postProcess: reorderGenerics([0, 1, 3]),
    },
    {
      from: "MutationHookOptions",
      to: "Options",
      postProcess: reorderGenerics([0, 1, 3]),
    },
    { from: "MutationResult", to: "Result" },
    {
      from: "MutationTuple",
      to: "ResultTuple",
      postProcess: reorderGenerics([0, 1, 3]),
    },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useMutation", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    { from: "BaseSubscriptionOptions", to: "Options" },
    { from: "OnDataOptions" },
    { from: "OnSubscriptionDataOptions" },
    { from: "SubscriptionHookOptions", to: "Options" },
    {
      from: "SubscriptionResult",
      to: "Result",
      postProcess: reorderGenerics([0]),
    },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useSubscription", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    { from: "QueryFunctionOptions", to: "Options" },
    { from: "QueryHookOptions", to: "Options" },
    { from: "QueryResult", to: "Result" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useQuery", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    {
      from: "SuspenseQueryHookFetchPolicy",
      to: "FetchPolicy",
      alternativeModules: ["@apollo/client"],
    },
    {
      from: "SuspenseQueryHookOptions",
      to: "Options",
      alternativeModules: [],
      postProcess: reorderGenerics([1]),
    },
    { from: "UseSuspenseQueryResult", to: "Result" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/react" },
      to: { namespace: "useSuspenseQuery" },
      importType: "type",
    })
  ),
  ...[{ from: "UseQueryRefHandlersResult", to: "Result" }].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useQueryRefHandlers", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    { from: "UseFragmentOptions", to: "Options" },
    { from: "UseFragmentResult", to: "Result" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useFragment", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[{ from: "UseReadQueryResult", to: "Result" }].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useReadQuery", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    { from: "UseSuspenseFragmentOptions", to: "Options" },
    { from: "UseSuspenseFragmentResult", to: "Result" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/react",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "useSuspenseFragment", alternativeModules: [] },
      importType: "type",
    })
  ),
  {
    from: {
      module: "@apollo/client/testing",
      identifier: "MockedProvider",
    },
    to: {
      module: "@apollo/client/testing/react",
    },
    importType: "value",
  },
  {
    from: {
      module: "@apollo/client/testing",
      identifier: "MockedProviderProps",
    },
    to: {
      module: "@apollo/client/testing/react",
    },
    importType: "type",
  },
  ...[
    { from: "MockedRequest" },
    { from: "MockedResponse" },
    { from: "MockLinkOptions", to: "Options" },
    { from: "ResultFunction" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/testing" },
      to: { namespace: "MockLink" },
      importType: "type",
    })
  ),
  ...[
    // move into `ApolloLink` type namespace
    {
      from: "FetchResult",
      to: "Result", // FetchResult<TData, TContext, TExtensions> -> ApolloLink.Result<TData, TExtensions>
      postProcess: reorderGenerics([0, 2]),
    },
    { from: "GraphQLRequest", to: "Request" },
    { from: "NextLink", to: "ForwardFunction" },
    { from: "Operation" },
    { from: "RequestHandler" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/link",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "ApolloLink" },
      importType: "type",
    })
  ),
  ...[
    { from: "ExecutionPatchIncrementalResult", to: "SubsequentResult" },
    { from: "ExecutionPatchInitialResult", to: "InitialResult" },
    { from: "ExecutionPatchResult", to: "Chunk" },
    { from: "IncrementalPayload", to: "IncrementalDeferPayload" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/link",
        alternativeModules: ["@apollo/client"],
      },
      to: {
        module: "@apollo/client/incremental",
        alternativeModules: [],
        namespace: "Defer20220824Handler",
      },
      importType: "type",
    })
  ),
  {
    from: {
      identifier: "Path",
      module: "@apollo/client/link",
      alternativeModules: ["@apollo/client"],
    },
    to: {
      module: "@apollo/client/incremental",
      namespace: "Incremental",
    },
    importType: "type",
  },
  {
    from: {
      identifier: "SingleExecutionResult",
      module: "@apollo/client/link",
      alternativeModules: ["@apollo/client"],
    },
    to: {
      identifier: "FormattedExecutionResult",
      module: "graphql",
    },
    importType: "type",
  },
  ...[{ from: "BatchHandler" }].map(
    moveInto({
      from: {
        module: "@apollo/client/link/batch",
      },
      to: {
        namespace: "BatchLink",
      },
      importType: "type",
    })
  ),
  ...[{ from: "ContextSetter", to: "LegacyContextSetter" }].map(
    moveInto({
      from: {
        module: "@apollo/client/link/context",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "SetContextLink", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[
    { from: "ErrorHandler" },
    { from: "ErrorResponse", to: "ErrorHandlerOptions" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/link/error",
      },
      to: { namespace: "ErrorLink" },
      importType: "type",
    })
  ),
  ...[{ from: "ServerParseError" }].map(
    moveInto({
      from: {
        module: "@apollo/client/link/http",
      },
      to: {
        module: "@apollo/client/errors",
      },
      importType: "type",
    })
  ),
  ...[{ from: "ErrorResponse", to: "DisableFunctionOptions" }].map(
    moveInto({
      from: {
        module: "@apollo/client/link/persisted-queries",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "PersistedQueryLink", alternativeModules: [] },
      importType: "type",
    })
  ),
  ...[{ from: "RemoveTypenameFromVariablesOptions", to: "Options" }].map(
    moveInto({
      from: {
        module: "@apollo/client/link/remove-typename",
      },
      to: { namespace: "RemoveTypenameFromVariablesLink" },
      importType: "type",
    })
  ),
  ...[{ from: "ServerError" }].map(
    moveInto({
      from: {
        module: "@apollo/client/link/utils",
      },
      to: {
        module: "@apollo/client/errors",
      },
      importType: "type",
    })
  ),
  ...[{ from: "WebSocketParams", to: "Configuration" }].map(
    moveInto({
      from: {
        module: "@apollo/client/link/ws",
      },
      to: {
        namespace: "WebSocketLink",
      },
      importType: "type",
    })
  ),
  ...[
    { from: "isNetworkRequestInFlight" },
    { from: "isNetworkRequestSettled" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/core/networkStatus",
        alternativeModules: ["@apollo/client/core", "@apollo/client"],
      },
      to: {
        module: "@apollo/client/utilities",
        alternativeModules: [],
      },
      importType: "value",
    })
  ),
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
  postProcess?(args: {
    context: UtilContext;
    namespace?: string;
    identifier: string;
    renamedSpecifierPath: j.ASTPath<namedTypes.ImportSpecifier>;
  }): void;
}

interface IdentifierRenameCommon extends Omit<IdentifierRename, "from"> {
  from: Omit<IdentifierRename["from"], "identifier"> & {
    identifier?: string;
  };
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

function reorderGenerics(
  newOrder: number[]
): (args: {
  context: UtilContext;
  namespace?: string;
  identifier: string;
  renamedSpecifierPath: j.ASTPath<namedTypes.ImportSpecifier>;
}) => void {
  return ({ context, identifier, namespace, renamedSpecifierPath }) => {
    reorderGenericArguments({
      context,
      namespace,
      identifier,
      scope: renamedSpecifierPath.scope,
      newOrder,
    });
  };
}

function moveInto(common: IdentifierRenameCommon) {
  return ({
    from,
    to = from,
    postProcess = common.postProcess,
  }: {
    from: string;
    to?: string;
    postProcess?: IdentifierRename["postProcess"];
  }): IdentifierRename => ({
    ...common,
    postProcess,
    from: { ...common.from, identifier: from },
    to: { ...common.to, identifier: to },
  });
}
