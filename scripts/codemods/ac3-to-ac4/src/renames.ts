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
    { from: "ApolloConsumer" },
    { from: "getApolloContext" },
    { from: "resetApolloContext" },
    { from: "DocumentType" },
    { from: "operationName" },
    { from: "parser" },
    { from: "createQueryPreloader" },
    { from: "useQuery" },
    { from: "useSuspenseQuery" },
    { from: "useBackgroundQuery" },
    { from: "useSuspenseFragment" },
    { from: "useLoadableQuery" },
    { from: "useQueryRefHandlers" },
    { from: "useReadQuery" },
    { from: "skipToken" },
    { from: "useApolloClient" },
    { from: "useLazyQuery" },
    { from: "useMutation" },
    { from: "useSubscription" },
    { from: "useReactiveVar" },
    { from: "useFragment" },
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
    { from: "IDocumentDefinition" },
    { from: "PreloadQueryOptions" },
    { from: "PreloadQueryFetchPolicy" },
    { from: "PreloadQueryFunction" },
    { from: "UseSuspenseQueryResult" },
    { from: "UseBackgroundQueryResult" },
    { from: "UseSuspenseFragmentResult" },
    { from: "UseSuspenseFragmentOptions" },
    { from: "LoadQueryFunction" },
    { from: "UseLoadableQueryResult" },
    { from: "UseQueryRefHandlersResult" },
    { from: "UseReadQueryResult" },
    { from: "SkipToken" },
    { from: "UseFragmentOptions" },
    { from: "UseFragmentResult" },
    { from: "QueryReference" },
    { from: "QueryRef" },
    { from: "PreloadedQueryRef" },
    { from: "Context" },
    { from: "CommonOptions" },
    { from: "BaseQueryOptions" },
    { from: "QueryFunctionOptions" },
    { from: "ObservableQueryFields" },
    { from: "QueryResult" },
    { from: "QueryDataOptions" },
    { from: "QueryHookOptions" },
    { from: "LazyQueryHookOptions" },
    { from: "LazyQueryHookExecOptions" },
    { from: "SuspenseQueryHookFetchPolicy" },
    { from: "SuspenseQueryHookOptions" },
    { from: "BackgroundQueryHookFetchPolicy" },
    { from: "BackgroundQueryHookOptions" },
    { from: "LoadableQueryHookFetchPolicy" },
    { from: "LoadableQueryHookOptions" },
    { from: "QueryLazyOptions" },
    { from: "LazyQueryResult" },
    { from: "QueryTuple" },
    { from: "LazyQueryExecFunction" },
    { from: "LazyQueryResultTuple" },
    { from: "RefetchQueriesFunction" },
    { from: "BaseMutationOptions" },
    { from: "MutationFunctionOptions" },
    { from: "MutationResult" },
    { from: "MutationFunction" },
    { from: "MutationHookOptions" },
    { from: "MutationDataOptions" },
    { from: "MutationTuple" },
    { from: "OnDataOptions" },
    { from: "OnSubscriptionDataOptions" },
    { from: "BaseSubscriptionOptions" },
    { from: "SubscriptionResult" },
    { from: "SubscriptionHookOptions" },
    { from: "SubscriptionDataOptions" },
    { from: "SubscriptionCurrentObservable" },
    { from: "VariablesOption" },
    { from: "NoInfer" },
  ].map(
    moveInto({
      from: { module: "@apollo/client" },
      to: { module: "@apollo/client/react" },
      importType: "type",
    })
  ),
  ...[
    // move to the `@apollo/client/react` entry point
    { from: "QueryRef" },
    { from: "PreloadedQueryRef" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/react/internal" },
      to: { module: "@apollo/client/react" },
      importType: "type",
    })
  ),
  ...[
    // move to the `@apollo/client/utilities/internal` entry point
    { from: "AutoCleanedStrongCache" },
    { from: "AutoCleanedWeakCache" },
    { from: "argumentsObjectFromField" },
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
    { from: "getDefaultValues" },
    { from: "getFragmentFromSelection" },
    { from: "getFragmentQueryDocument" },
    { from: "getFragmentDefinition" },
    { from: "getFragmentDefinitions" },
    { from: "getGraphQLErrorsFromResult" },
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
    { from: "removeDirectivesFromDocument" },
    { from: "resultKeyNameFromField" },
    { from: "shouldInclude" },
    { from: "storeKeyNameFromField" },
    { from: "stringifyForDisplay" },
    { from: "toQueryResult" },
    { from: "filterMap" },
    { from: "getApolloCacheMemoryInternals" },
    { from: "getApolloClientMemoryInternals" },
    { from: "getInMemoryCacheMemoryInternals" },
    { from: "registerGlobalCache" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/utilities",
        alternativeModules: [
          // mergeOptions, makeReference
          "@apollo/client",
          "@apollo/client/core",
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
  ...[{ from: "__DEV__" }, { from: "DEV", to: "__DEV__" }].map(
    moveInto({
      from: {
        module: "@apollo/client/utilities/global",
        alternativeModules: ["@apollo/client/utilities"],
      },
      to: { module: "@apollo/client/utilities/environment" },
      importType: "value",
    })
  ),
  ...[{ from: "maybe" }, { from: "global" }].map(
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
    { from: "newInvariantError" },
    { from: "InvariantError" },
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
    {
      from: "QueryOptions",
      postProcess: reorderGenerics([1, 0]),
    },
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
    { from: "SubscribeToMoreOptions" },
    { from: "FetchMoreOptions" },
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
  ...[
    // move into `ApolloLink` runtime namespace
    { from: "from" },
    { from: "empty" },
    { from: "concat" },
    { from: "split" },
  ].map(
    moveInto({
      from: {
        module: "@apollo/client/link",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "ApolloLink" },
      importType: "value",
    })
  ),
  ...[
    // move into `ApolloLink` type namespace
    { from: "FetchResult", to: "Result" },
    { from: "GraphQLRequest", to: "Request" },
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
  ...[{ from: "ErrorResponse", to: "ErrorHandlerOptions" }].map(
    moveInto({
      from: {
        module: "@apollo/client/link/error",
        alternativeModules: ["@apollo/client"],
      },
      to: { namespace: "ErrorLink", alternativeModules: [] },
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
  postProcess?(args: {
    context: UtilContext;
    namespace?: string;
    identifier: string;
    renamedSpecifierPath: j.ASTPath<namedTypes.ImportSpecifier>;
  }): void;
}

export interface IdentifierRenameCommon extends Omit<IdentifierRename, "from"> {
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
