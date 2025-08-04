import type { namedTypes } from "ast-types";
import type * as j from "jscodeshift";
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
    // move to the `@apollo/client/react` entry point
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
    { from: "useSubscription" },
    { from: "useSuspenseFragment" },
    { from: "useSuspenseQuery" },
    { from: "useReactiveVar" },
    { from: "useReadQuery" },
  ].map(
    moveInto({
      from: { module: "@apollo/client" },
      to: { module: "@apollo/client/react" },
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
      from: { module: "@apollo/client/react" },
      to: { namespace: "useBackgroundQuery" },
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
      from: { module: "@apollo/client/react" },
      to: { namespace: "useLazyQuery" },
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
      from: { module: "@apollo/client/react" },
      to: { namespace: "useLoadableQuery" },
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
      from: { module: "@apollo/client/react" },
      to: { namespace: "useMutation" },
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
      from: { module: "@apollo/client/react" },
      to: { namespace: "useSubscription" },
      importType: "type",
    })
  ),
  ...[
    { from: "QueryHookOptions", to: "Options" },
    { from: "QueryResult", to: "Result" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/react" },
      to: { namespace: "useQuery" },
      importType: "type",
    })
  ),
  ...[
    { from: "SuspenseQueryHookFetchPolicy", to: "FetchPolicy" },
    {
      from: "SuspenseQueryHookOptions",
      to: "Options",
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
      from: { module: "@apollo/client/react" },
      to: { namespace: "useQueryRefHandlers" },
      importType: "type",
    })
  ),
  ...[
    { from: "UseFragmentOptions", to: "Options" },
    { from: "UseFragmentResult", to: "Result" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/react" },
      to: { namespace: "useFragment" },
      importType: "type",
    })
  ),
  ...[{ from: "UseReadQueryResult", to: "Result" }].map(
    moveInto({
      from: { module: "@apollo/client/react" },
      to: { namespace: "useReadQuery" },
      importType: "type",
    })
  ),
  ...[
    { from: "UseSuspenseFragmentOptions", to: "Options" },
    { from: "UseSuspenseFragmentResult", to: "Result" },
  ].map(
    moveInto({
      from: { module: "@apollo/client/react" },
      to: { namespace: "useSuspenseFragment" },
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
      identifier: "MockedProvider",
    },
    importType: "value",
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
    j: j.JSCodeshift;
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
  j: j.JSCodeshift;
  namespace?: string;
  identifier: string;
  renamedSpecifierPath: j.ASTPath<namedTypes.ImportSpecifier>;
}) => void {
  return ({ j, identifier, namespace, renamedSpecifierPath }) => {
    reorderGenericArguments({
      j,
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
