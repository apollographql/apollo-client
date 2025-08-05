import { applyTransform } from "jscodeshift/dist/testUtils";
import { expect, test  } from "vitest";

import imports from "../imports.js";

function ts(code: TemplateStringsArray): string {
  return code[0];
}

test("ApolloClientOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloClientOptions} from "@apollo/client";
type _Test_ApolloClientOptions = ApolloClientOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_ApolloClientOptions = ApolloClient.Options;"
  `);
});


test("ApolloQueryResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloQueryResult} from "@apollo/client";
type _Test_ApolloQueryResult = ApolloQueryResult<TData, TStates>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ObservableQuery} from "@apollo/client";
    type _Test_ApolloQueryResult = ObservableQuery.Result<TData, TStates>;"
  `);
});


test("DefaultOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DefaultOptions} from "@apollo/client";
type _Test_DefaultOptions = DefaultOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_DefaultOptions = ApolloClient.DefaultOptions;"
  `);
});


test("DevtoolsOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DevtoolsOptions} from "@apollo/client";
type _Test_DevtoolsOptions = DevtoolsOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_DevtoolsOptions = ApolloClient.DevtoolsOptions;"
  `);
});


test("MutateResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutateResult} from "@apollo/client";
type _Test_MutateResult = MutateResult<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_MutateResult = ApolloClient.MutateResult<TData>;"
  `);
});


test("MutationOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationOptions} from "@apollo/client";
type _Test_MutationOptions = MutationOptions<TData, TVariables, TCache>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_MutationOptions = ApolloClient.MutateOptions<TData, TVariables, TCache>;"
  `);
});


test("QueryOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {QueryOptions} from "@apollo/client";
type _Test_QueryOptions = QueryOptions<TVariables, TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_QueryOptions = ApolloClient.QueryOptions<TData, TVariables>;"
  `);
});


test("RefetchQueriesOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueriesOptions} from "@apollo/client";
type _Test_RefetchQueriesOptions = RefetchQueriesOptions<TCache, TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_RefetchQueriesOptions = ApolloClient.RefetchQueriesOptions<TCache, TResult>;"
  `);
});


test("RefetchQueriesResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueriesResult} from "@apollo/client";
type _Test_RefetchQueriesResult = RefetchQueriesResult<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_RefetchQueriesResult = ApolloClient.RefetchQueriesResult<TResult>;"
  `);
});


test("SubscribeToMoreOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscribeToMoreOptions} from "@apollo/client";
type _Test_SubscribeToMoreOptions = SubscribeToMoreOptions<TData, TSubscriptionVariables, TSubscriptionData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ObservableQuery} from "@apollo/client";
    type _Test_SubscribeToMoreOptions = ObservableQuery.SubscribeToMoreOptions<TData, TSubscriptionVariables, TSubscriptionData, TVariables>;"
  `);
});


test("SubscriptionOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscriptionOptions} from "@apollo/client";
type _Test_SubscriptionOptions = SubscriptionOptions<TVariables, TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_SubscriptionOptions = ApolloClient.SubscribeOptions<TData, TVariables>;"
  `);
});


test("WatchQueryOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {WatchQueryOptions} from "@apollo/client";
type _Test_WatchQueryOptions = WatchQueryOptions<TVariables, TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_WatchQueryOptions = ApolloClient.WatchQueryOptions<TData, TVariables>;"
  `);
});


test("ApolloClient", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloClient} from "@apollo/client";
class _Test_ApolloClient extends ApolloClient {}
const _test_ApolloClient = new ApolloClient(options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ObservableQuery", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ObservableQuery} from "@apollo/client";
class _Test_ObservableQuery extends ObservableQuery<TData, TVariables> {}
const _test_ObservableQuery = new ObservableQuery<TData, TVariables>(param0)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ErrorPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ErrorPolicy} from "@apollo/client";
type _Test_ErrorPolicy = ErrorPolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FetchPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FetchPolicy} from "@apollo/client";
type _Test_FetchPolicy = FetchPolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MutationFetchPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationFetchPolicy} from "@apollo/client";
type _Test_MutationFetchPolicy = MutationFetchPolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("RefetchWritePolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchWritePolicy} from "@apollo/client";
type _Test_RefetchWritePolicy = RefetchWritePolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("SubscribeToMoreFunction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscribeToMoreFunction} from "@apollo/client";
type _Test_SubscribeToMoreFunction = SubscribeToMoreFunction<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("SubscribeToMoreUpdateQueryFn", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscribeToMoreUpdateQueryFn} from "@apollo/client";
type _Test_SubscribeToMoreUpdateQueryFn = SubscribeToMoreUpdateQueryFn<TData, TVariables, TSubscriptionData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("UpdateQueryMapFn", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {UpdateQueryMapFn} from "@apollo/client";
type _Test_UpdateQueryMapFn = UpdateQueryMapFn<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("UpdateQueryOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {UpdateQueryOptions} from "@apollo/client";
type _Test_UpdateQueryOptions = UpdateQueryOptions<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("WatchQueryFetchPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {WatchQueryFetchPolicy} from "@apollo/client";
type _Test_WatchQueryFetchPolicy = WatchQueryFetchPolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("isNetworkRequestSettled", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {isNetworkRequestSettled} from "@apollo/client";
isNetworkRequestSettled(networkStatus)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("NetworkStatus", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {NetworkStatus} from "@apollo/client";
type _Test_NetworkStatus = NetworkStatus;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DataState", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DataState} from "@apollo/client";
type _Test_DataState = DataState<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DataValue", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DataValue} from "@apollo/client";
const _Test_DataValue = DataValue;
type _Test_DataValue_Complete = DataValue.Complete<TData>;
type _Test_DataValue_Streaming = DataValue.Streaming<TData>;
type _Test_DataValue_Partial = DataValue.Partial<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DefaultContext", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DefaultContext} from "@apollo/client";
type _Test_DefaultContext = DefaultContext;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ErrorLike", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ErrorLike} from "@apollo/client";
type _Test_ErrorLike = ErrorLike;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("GetDataState", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {GetDataState} from "@apollo/client";
type _Test_GetDataState = GetDataState<TData, TState>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueriesInclude", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueriesInclude} from "@apollo/client";
type _Test_InternalRefetchQueriesInclude = InternalRefetchQueriesInclude;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueriesMap", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueriesMap} from "@apollo/client";
type _Test_InternalRefetchQueriesMap = InternalRefetchQueriesMap<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueriesOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueriesOptions} from "@apollo/client";
type _Test_InternalRefetchQueriesOptions = InternalRefetchQueriesOptions<TCache, TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueriesResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueriesResult} from "@apollo/client";
type _Test_InternalRefetchQueriesResult = InternalRefetchQueriesResult<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueryDescriptor", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueryDescriptor} from "@apollo/client";
type _Test_InternalRefetchQueryDescriptor = InternalRefetchQueryDescriptor;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MutationQueryReducer", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationQueryReducer} from "@apollo/client";
type _Test_MutationQueryReducer = MutationQueryReducer<T>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MutationQueryReducersMap", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationQueryReducersMap} from "@apollo/client";
type _Test_MutationQueryReducersMap = MutationQueryReducersMap<T>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MutationUpdaterFunction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationUpdaterFunction} from "@apollo/client";
type _Test_MutationUpdaterFunction = MutationUpdaterFunction<TData, TVariables, TCache>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("NormalizedExecutionResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {NormalizedExecutionResult} from "@apollo/client";
type _Test_NormalizedExecutionResult = NormalizedExecutionResult<TData, TExtensions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("OnQueryUpdated", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {OnQueryUpdated} from "@apollo/client";
type _Test_OnQueryUpdated = OnQueryUpdated<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("OperationVariables", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {OperationVariables} from "@apollo/client";
type _Test_OperationVariables = OperationVariables;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("RefetchQueriesInclude", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueriesInclude} from "@apollo/client";
type _Test_RefetchQueriesInclude = RefetchQueriesInclude;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("RefetchQueriesPromiseResults", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueriesPromiseResults} from "@apollo/client";
type _Test_RefetchQueriesPromiseResults = RefetchQueriesPromiseResults<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("RefetchQueryDescriptor", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueryDescriptor} from "@apollo/client";
type _Test_RefetchQueryDescriptor = RefetchQueryDescriptor;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("SubscriptionObservable", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscriptionObservable} from "@apollo/client";
type _Test_SubscriptionObservable = SubscriptionObservable<T>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("TypedDocumentNode", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {TypedDocumentNode} from "@apollo/client";
type _Test_TypedDocumentNode = TypedDocumentNode<TResult, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("TypeOverrides", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {TypeOverrides} from "@apollo/client";
type _Test_TypeOverrides = TypeOverrides;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("CombinedGraphQLErrors", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {CombinedGraphQLErrors} from "@apollo/client";
class _Test_CombinedGraphQLErrors extends CombinedGraphQLErrors {}
const _test_CombinedGraphQLErrors = new CombinedGraphQLErrors(result)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("CombinedProtocolErrors", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {CombinedProtocolErrors} from "@apollo/client";
class _Test_CombinedProtocolErrors extends CombinedProtocolErrors {}
const _test_CombinedProtocolErrors = new CombinedProtocolErrors(protocolErrors)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("LinkError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {LinkError} from "@apollo/client";
const _Test_LinkError = LinkError;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("LocalStateError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {LocalStateError} from "@apollo/client";
class _Test_LocalStateError extends LocalStateError {}
const _test_LocalStateError = new LocalStateError(message, options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ServerError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ServerError} from "@apollo/client";
class _Test_ServerError extends ServerError {}
const _test_ServerError = new ServerError(message, options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ServerParseError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ServerParseError} from "@apollo/client";
class _Test_ServerParseError extends ServerParseError {}
const _test_ServerParseError = new ServerParseError(originalParseError, options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("UnconventionalError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {UnconventionalError} from "@apollo/client";
class _Test_UnconventionalError extends UnconventionalError {}
const _test_UnconventionalError = new UnconventionalError(errorType)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ApolloReducerConfig", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloReducerConfig} from "@apollo/client";
type _Test_ApolloReducerConfig = ApolloReducerConfig;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Cache", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Cache} from "@apollo/client";
const _Test_Cache = Cache;
type _Test_Cache_WatchCallback = Cache.WatchCallback<TData>;
type _Test_Cache_ReadOptions = Cache.ReadOptions<TData, TVariables>;
type _Test_Cache_WriteOptions = Cache.WriteOptions<TData, TVariables>;
type _Test_Cache_DiffOptions = Cache.DiffOptions<TData, TVariables>;
type _Test_Cache_WatchOptions = Cache.WatchOptions<TData, TVariables>;
type _Test_Cache_EvictOptions = Cache.EvictOptions;
type _Test_Cache_ResetOptions = Cache.ResetOptions;
type _Test_Cache_ModifyOptions = Cache.ModifyOptions<Entity>;
type _Test_Cache_BatchOptions = Cache.BatchOptions<TCache, TUpdateResult>;
type _Test_Cache_ReadQueryOptions = Cache.ReadQueryOptions<TData, TVariables>;
type _Test_Cache_ReadFragmentOptions = Cache.ReadFragmentOptions<TData, TVariables>;
type _Test_Cache_WriteQueryOptions = Cache.WriteQueryOptions<TData, TVariables>;
type _Test_Cache_WriteFragmentOptions = Cache.WriteFragmentOptions<TData, TVariables>;
type _Test_Cache_UpdateQueryOptions = Cache.UpdateQueryOptions<TData, TVariables>;
type _Test_Cache_UpdateFragmentOptions = Cache.UpdateFragmentOptions<TData, TVariables>;
type _Test_Cache_DiffResult = Cache.DiffResult<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DiffQueryAgainstStoreOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DiffQueryAgainstStoreOptions} from "@apollo/client";
type _Test_DiffQueryAgainstStoreOptions = DiffQueryAgainstStoreOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FieldFunctionOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FieldFunctionOptions} from "@apollo/client";
type _Test_FieldFunctionOptions = FieldFunctionOptions<TArgs, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FieldMergeFunction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FieldMergeFunction} from "@apollo/client";
type _Test_FieldMergeFunction = FieldMergeFunction<TExisting, TIncoming, TOptions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FieldPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FieldPolicy} from "@apollo/client";
type _Test_FieldPolicy = FieldPolicy<TExisting, TIncoming, TReadResult, TOptions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FieldReadFunction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FieldReadFunction} from "@apollo/client";
type _Test_FieldReadFunction = FieldReadFunction<TExisting, TReadResult, TOptions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("IdGetter", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {IdGetter} from "@apollo/client";
type _Test_IdGetter = IdGetter;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("IdGetterObj", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {IdGetterObj} from "@apollo/client";
type _Test_IdGetterObj = IdGetterObj;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InMemoryCacheConfig", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InMemoryCacheConfig} from "@apollo/client";
type _Test_InMemoryCacheConfig = InMemoryCacheConfig;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MergeInfo", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MergeInfo} from "@apollo/client";
type _Test_MergeInfo = MergeInfo;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MergeTree", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MergeTree} from "@apollo/client";
type _Test_MergeTree = MergeTree;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("NormalizedCache", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {NormalizedCache} from "@apollo/client";
type _Test_NormalizedCache = NormalizedCache;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("NormalizedCacheObject", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {NormalizedCacheObject} from "@apollo/client";
type _Test_NormalizedCacheObject = NormalizedCacheObject;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("OptimisticStoreItem", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {OptimisticStoreItem} from "@apollo/client";
type _Test_OptimisticStoreItem = OptimisticStoreItem;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("PossibleTypesMap", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {PossibleTypesMap} from "@apollo/client";
type _Test_PossibleTypesMap = PossibleTypesMap;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ReactiveVar", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ReactiveVar} from "@apollo/client";
type _Test_ReactiveVar = ReactiveVar<T>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ReadMergeModifyContext", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ReadMergeModifyContext} from "@apollo/client";
type _Test_ReadMergeModifyContext = ReadMergeModifyContext;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ReadQueryOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ReadQueryOptions} from "@apollo/client";
type _Test_ReadQueryOptions = ReadQueryOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("StoreValue", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {StoreValue} from "@apollo/client";
type _Test_StoreValue = StoreValue;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Transaction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Transaction} from "@apollo/client";
type _Test_Transaction = Transaction;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("TypePolicies", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {TypePolicies} from "@apollo/client";
type _Test_TypePolicies = TypePolicies;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("TypePolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {TypePolicy} from "@apollo/client";
type _Test_TypePolicy = TypePolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("WatchFragmentOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {WatchFragmentOptions} from "@apollo/client";
type _Test_WatchFragmentOptions = WatchFragmentOptions<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("WatchFragmentResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {WatchFragmentResult} from "@apollo/client";
type _Test_WatchFragmentResult = WatchFragmentResult<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ApolloCache", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloCache} from "@apollo/client";
class _Test_ApolloCache extends ApolloCache {}
const _test_ApolloCache = new ApolloCache()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("defaultDataIdFromObject", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {defaultDataIdFromObject} from "@apollo/client";
defaultDataIdFromObject(param0, context)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InMemoryCache", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InMemoryCache} from "@apollo/client";
class _Test_InMemoryCache extends InMemoryCache {}
const _test_InMemoryCache = new InMemoryCache(config)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("makeVar", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {makeVar} from "@apollo/client";
makeVar<T>(value)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MissingFieldError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MissingFieldError} from "@apollo/client";
class _Test_MissingFieldError extends MissingFieldError {}
const _test_MissingFieldError = new MissingFieldError(message, path, query, variables)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ApolloLink", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloLink} from "@apollo/client";
class _Test_ApolloLink extends ApolloLink {}
const _test_ApolloLink = new ApolloLink(request)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("concat", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {concat} from "@apollo/client";
const _Test_concat = concat;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    const _Test_concat = ApolloLink.concat;"
  `);
});


test("empty", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {empty} from "@apollo/client";
const _Test_empty = empty;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    const _Test_empty = ApolloLink.empty;"
  `);
});


test("execute", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {execute} from "@apollo/client";
const _Test_execute = execute;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("from", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {from} from "@apollo/client";
const _Test_from = from;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    const _Test_from = ApolloLink.from;"
  `);
});


test("split", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {split} from "@apollo/client";
const _Test_split = split;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    const _Test_split = ApolloLink.split;"
  `);
});


test("ApolloPayloadResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloPayloadResult} from "@apollo/client";
type _Test_ApolloPayloadResult = ApolloPayloadResult<TData, TExtensions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DocumentNode", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DocumentNode} from "@apollo/client";
type _Test_DocumentNode = DocumentNode;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FetchResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FetchResult} from "@apollo/client";
type _Test_FetchResult = FetchResult<TData, TExtensions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    type _Test_FetchResult = ApolloLink.Result<TData, TExtensions>;"
  `);
});


test("GraphQLRequest", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {GraphQLRequest} from "@apollo/client";
type _Test_GraphQLRequest = GraphQLRequest;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    type _Test_GraphQLRequest = ApolloLink.Request;"
  `);
});


test("Operation", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Operation} from "@apollo/client";
type _Test_Operation = Operation;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    type _Test_Operation = ApolloLink.Operation;"
  `);
});


test("RequestHandler", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RequestHandler} from "@apollo/client";
type _Test_RequestHandler = RequestHandler;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    type _Test_RequestHandler = ApolloLink.RequestHandler;"
  `);
});


test("checkFetcher", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {checkFetcher} from "@apollo/client";
const _Test_checkFetcher = checkFetcher;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("createHttpLink", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {createHttpLink} from "@apollo/client";
const _Test_createHttpLink = createHttpLink;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("createSignalIfSupported", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {createSignalIfSupported} from "@apollo/client";
const _Test_createSignalIfSupported = createSignalIfSupported;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("defaultPrinter", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {defaultPrinter} from "@apollo/client";
const _Test_defaultPrinter = defaultPrinter;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("fallbackHttpConfig", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {fallbackHttpConfig} from "@apollo/client";
const _Test_fallbackHttpConfig = fallbackHttpConfig;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("HttpLink", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {HttpLink} from "@apollo/client";
class _Test_HttpLink extends HttpLink {}
const _test_HttpLink = new HttpLink(options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("parseAndCheckHttpResponse", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {parseAndCheckHttpResponse} from "@apollo/client";
parseAndCheckHttpResponse(operations)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("rewriteURIForGET", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {rewriteURIForGET} from "@apollo/client";
rewriteURIForGET(chosenURI, body)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("selectHttpOptionsAndBody", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {selectHttpOptionsAndBody} from "@apollo/client";
selectHttpOptionsAndBody(operation, fallbackConfig, configs)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("selectHttpOptionsAndBodyInternal", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {selectHttpOptionsAndBodyInternal} from "@apollo/client";
selectHttpOptionsAndBodyInternal(operation, printer, configs)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("selectURI", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {selectURI} from "@apollo/client";
const _Test_selectURI = selectURI;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("serializeFetchParameter", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {serializeFetchParameter} from "@apollo/client";
const _Test_serializeFetchParameter = serializeFetchParameter;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ClientParseError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ClientParseError} from "@apollo/client";
type _Test_ClientParseError = ClientParseError;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DataMasking", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DataMasking} from "@apollo/client";
type _Test_DataMasking = DataMasking;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FragmentType", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FragmentType} from "@apollo/client";
type _Test_FragmentType = FragmentType<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Masked", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Masked} from "@apollo/client";
type _Test_Masked = Masked<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MaskedDocumentNode", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MaskedDocumentNode} from "@apollo/client";
type _Test_MaskedDocumentNode = MaskedDocumentNode<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MaybeMasked", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MaybeMasked} from "@apollo/client";
type _Test_MaybeMasked = MaybeMasked<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Unmasked", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Unmasked} from "@apollo/client";
type _Test_Unmasked = Unmasked<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DocumentTransformCacheKey", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DocumentTransformCacheKey} from "@apollo/client";
type _Test_DocumentTransformCacheKey = DocumentTransformCacheKey;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Reference", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Reference} from "@apollo/client";
type _Test_Reference = Reference;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("StoreObject", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {StoreObject} from "@apollo/client";
type _Test_StoreObject = StoreObject;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DocumentTransform", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DocumentTransform} from "@apollo/client";
class _Test_DocumentTransform extends DocumentTransform {}
const _test_DocumentTransform = new DocumentTransform(transform, options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("isReference", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {isReference} from "@apollo/client";
isReference(obj)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Observable", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Observable} from "@apollo/client";
class _Test_Observable extends Observable<T> {}
const _test_Observable = new Observable<T>(subscribe)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("setLogVerbosity", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {setLogVerbosity} from "@apollo/client";
setLogVerbosity(level)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("disableExperimentalFragmentVariables", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {disableExperimentalFragmentVariables} from "@apollo/client";
disableExperimentalFragmentVariables()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("disableFragmentWarnings", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {disableFragmentWarnings} from "@apollo/client";
disableFragmentWarnings()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("enableExperimentalFragmentVariables", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {enableExperimentalFragmentVariables} from "@apollo/client";
enableExperimentalFragmentVariables()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("gql", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {gql} from "@apollo/client";
gql(literals, args)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("resetCaches", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {resetCaches} from "@apollo/client";
resetCaches()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("build", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {build} from "@apollo/client";
const _Test_build = build;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("version", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {version} from "@apollo/client";
const _Test_version = version;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalTypes", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalTypes} from "@apollo/client";
const _Test_InternalTypes = InternalTypes;
type _Test_InternalTypes_NextFetchPolicyContext = InternalTypes.NextFetchPolicyContext<TData, TVariables>;
class _Test_InternalTypes_QueryManager extends InternalTypes.QueryManager {}
const _test_InternalTypes_QueryManager = new InternalTypes.QueryManager(options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("CustomHKT", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {CustomHKT} from "@apollo/client";
type _Test_CustomHKT = CustomHKT;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ApolloClientOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloClientOptions} from "@apollo/client";
type _Test_ApolloClientOptions = ApolloClientOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_ApolloClientOptions = ApolloClient.Options;"
  `);
});


test("ApolloQueryResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloQueryResult} from "@apollo/client";
type _Test_ApolloQueryResult = ApolloQueryResult<TData, TStates>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ObservableQuery} from "@apollo/client";
    type _Test_ApolloQueryResult = ObservableQuery.Result<TData, TStates>;"
  `);
});


test("DefaultOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DefaultOptions} from "@apollo/client";
type _Test_DefaultOptions = DefaultOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_DefaultOptions = ApolloClient.DefaultOptions;"
  `);
});


test("DevtoolsOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DevtoolsOptions} from "@apollo/client";
type _Test_DevtoolsOptions = DevtoolsOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_DevtoolsOptions = ApolloClient.DevtoolsOptions;"
  `);
});


test("MutateResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutateResult} from "@apollo/client";
type _Test_MutateResult = MutateResult<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_MutateResult = ApolloClient.MutateResult<TData>;"
  `);
});


test("MutationOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationOptions} from "@apollo/client";
type _Test_MutationOptions = MutationOptions<TData, TVariables, TCache>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_MutationOptions = ApolloClient.MutateOptions<TData, TVariables, TCache>;"
  `);
});


test("QueryOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {QueryOptions} from "@apollo/client";
type _Test_QueryOptions = QueryOptions<TVariables, TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_QueryOptions = ApolloClient.QueryOptions<TData, TVariables>;"
  `);
});


test("RefetchQueriesOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueriesOptions} from "@apollo/client";
type _Test_RefetchQueriesOptions = RefetchQueriesOptions<TCache, TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_RefetchQueriesOptions = ApolloClient.RefetchQueriesOptions<TCache, TResult>;"
  `);
});


test("RefetchQueriesResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueriesResult} from "@apollo/client";
type _Test_RefetchQueriesResult = RefetchQueriesResult<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_RefetchQueriesResult = ApolloClient.RefetchQueriesResult<TResult>;"
  `);
});


test("SubscribeToMoreOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscribeToMoreOptions} from "@apollo/client";
type _Test_SubscribeToMoreOptions = SubscribeToMoreOptions<TData, TSubscriptionVariables, TSubscriptionData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ObservableQuery} from "@apollo/client";
    type _Test_SubscribeToMoreOptions = ObservableQuery.SubscribeToMoreOptions<TData, TSubscriptionVariables, TSubscriptionData, TVariables>;"
  `);
});


test("SubscriptionOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscriptionOptions} from "@apollo/client";
type _Test_SubscriptionOptions = SubscriptionOptions<TVariables, TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_SubscriptionOptions = ApolloClient.SubscribeOptions<TData, TVariables>;"
  `);
});


test("WatchQueryOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {WatchQueryOptions} from "@apollo/client";
type _Test_WatchQueryOptions = WatchQueryOptions<TVariables, TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloClient} from "@apollo/client";
    type _Test_WatchQueryOptions = ApolloClient.WatchQueryOptions<TData, TVariables>;"
  `);
});


test("ApolloClient", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloClient} from "@apollo/client";
class _Test_ApolloClient extends ApolloClient {}
const _test_ApolloClient = new ApolloClient(options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ObservableQuery", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ObservableQuery} from "@apollo/client";
class _Test_ObservableQuery extends ObservableQuery<TData, TVariables> {}
const _test_ObservableQuery = new ObservableQuery<TData, TVariables>(param0)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ErrorPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ErrorPolicy} from "@apollo/client";
type _Test_ErrorPolicy = ErrorPolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FetchPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FetchPolicy} from "@apollo/client";
type _Test_FetchPolicy = FetchPolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MutationFetchPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationFetchPolicy} from "@apollo/client";
type _Test_MutationFetchPolicy = MutationFetchPolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("RefetchWritePolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchWritePolicy} from "@apollo/client";
type _Test_RefetchWritePolicy = RefetchWritePolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("SubscribeToMoreFunction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscribeToMoreFunction} from "@apollo/client";
type _Test_SubscribeToMoreFunction = SubscribeToMoreFunction<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("SubscribeToMoreUpdateQueryFn", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscribeToMoreUpdateQueryFn} from "@apollo/client";
type _Test_SubscribeToMoreUpdateQueryFn = SubscribeToMoreUpdateQueryFn<TData, TVariables, TSubscriptionData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("UpdateQueryMapFn", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {UpdateQueryMapFn} from "@apollo/client";
type _Test_UpdateQueryMapFn = UpdateQueryMapFn<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("UpdateQueryOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {UpdateQueryOptions} from "@apollo/client";
type _Test_UpdateQueryOptions = UpdateQueryOptions<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("WatchQueryFetchPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {WatchQueryFetchPolicy} from "@apollo/client";
type _Test_WatchQueryFetchPolicy = WatchQueryFetchPolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("isNetworkRequestSettled", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {isNetworkRequestSettled} from "@apollo/client";
isNetworkRequestSettled(networkStatus)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("NetworkStatus", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {NetworkStatus} from "@apollo/client";
type _Test_NetworkStatus = NetworkStatus;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DataState", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DataState} from "@apollo/client";
type _Test_DataState = DataState<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DataValue", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DataValue} from "@apollo/client";
const _Test_DataValue = DataValue;
type _Test_DataValue_Complete = DataValue.Complete<TData>;
type _Test_DataValue_Streaming = DataValue.Streaming<TData>;
type _Test_DataValue_Partial = DataValue.Partial<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DefaultContext", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DefaultContext} from "@apollo/client";
type _Test_DefaultContext = DefaultContext;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ErrorLike", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ErrorLike} from "@apollo/client";
type _Test_ErrorLike = ErrorLike;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("GetDataState", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {GetDataState} from "@apollo/client";
type _Test_GetDataState = GetDataState<TData, TState>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueriesInclude", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueriesInclude} from "@apollo/client";
type _Test_InternalRefetchQueriesInclude = InternalRefetchQueriesInclude;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueriesMap", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueriesMap} from "@apollo/client";
type _Test_InternalRefetchQueriesMap = InternalRefetchQueriesMap<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueriesOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueriesOptions} from "@apollo/client";
type _Test_InternalRefetchQueriesOptions = InternalRefetchQueriesOptions<TCache, TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueriesResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueriesResult} from "@apollo/client";
type _Test_InternalRefetchQueriesResult = InternalRefetchQueriesResult<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InternalRefetchQueryDescriptor", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InternalRefetchQueryDescriptor} from "@apollo/client";
type _Test_InternalRefetchQueryDescriptor = InternalRefetchQueryDescriptor;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MutationQueryReducer", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationQueryReducer} from "@apollo/client";
type _Test_MutationQueryReducer = MutationQueryReducer<T>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MutationQueryReducersMap", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationQueryReducersMap} from "@apollo/client";
type _Test_MutationQueryReducersMap = MutationQueryReducersMap<T>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MutationUpdaterFunction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MutationUpdaterFunction} from "@apollo/client";
type _Test_MutationUpdaterFunction = MutationUpdaterFunction<TData, TVariables, TCache>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("NormalizedExecutionResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {NormalizedExecutionResult} from "@apollo/client";
type _Test_NormalizedExecutionResult = NormalizedExecutionResult<TData, TExtensions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("OnQueryUpdated", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {OnQueryUpdated} from "@apollo/client";
type _Test_OnQueryUpdated = OnQueryUpdated<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("OperationVariables", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {OperationVariables} from "@apollo/client";
type _Test_OperationVariables = OperationVariables;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("RefetchQueriesInclude", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueriesInclude} from "@apollo/client";
type _Test_RefetchQueriesInclude = RefetchQueriesInclude;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("RefetchQueriesPromiseResults", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueriesPromiseResults} from "@apollo/client";
type _Test_RefetchQueriesPromiseResults = RefetchQueriesPromiseResults<TResult>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("RefetchQueryDescriptor", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RefetchQueryDescriptor} from "@apollo/client";
type _Test_RefetchQueryDescriptor = RefetchQueryDescriptor;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("SubscriptionObservable", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {SubscriptionObservable} from "@apollo/client";
type _Test_SubscriptionObservable = SubscriptionObservable<T>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("TypedDocumentNode", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {TypedDocumentNode} from "@apollo/client";
type _Test_TypedDocumentNode = TypedDocumentNode<TResult, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("TypeOverrides", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {TypeOverrides} from "@apollo/client";
type _Test_TypeOverrides = TypeOverrides;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("CombinedGraphQLErrors", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {CombinedGraphQLErrors} from "@apollo/client";
class _Test_CombinedGraphQLErrors extends CombinedGraphQLErrors {}
const _test_CombinedGraphQLErrors = new CombinedGraphQLErrors(result)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("CombinedProtocolErrors", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {CombinedProtocolErrors} from "@apollo/client";
class _Test_CombinedProtocolErrors extends CombinedProtocolErrors {}
const _test_CombinedProtocolErrors = new CombinedProtocolErrors(protocolErrors)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("LinkError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {LinkError} from "@apollo/client";
const _Test_LinkError = LinkError;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("LocalStateError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {LocalStateError} from "@apollo/client";
class _Test_LocalStateError extends LocalStateError {}
const _test_LocalStateError = new LocalStateError(message, options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ServerError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ServerError} from "@apollo/client";
class _Test_ServerError extends ServerError {}
const _test_ServerError = new ServerError(message, options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ServerParseError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ServerParseError} from "@apollo/client";
class _Test_ServerParseError extends ServerParseError {}
const _test_ServerParseError = new ServerParseError(originalParseError, options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("UnconventionalError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {UnconventionalError} from "@apollo/client";
class _Test_UnconventionalError extends UnconventionalError {}
const _test_UnconventionalError = new UnconventionalError(errorType)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ApolloReducerConfig", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloReducerConfig} from "@apollo/client";
type _Test_ApolloReducerConfig = ApolloReducerConfig;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Cache", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Cache} from "@apollo/client";
const _Test_Cache = Cache;
type _Test_Cache_WatchCallback = Cache.WatchCallback<TData>;
type _Test_Cache_ReadOptions = Cache.ReadOptions<TData, TVariables>;
type _Test_Cache_WriteOptions = Cache.WriteOptions<TData, TVariables>;
type _Test_Cache_DiffOptions = Cache.DiffOptions<TData, TVariables>;
type _Test_Cache_WatchOptions = Cache.WatchOptions<TData, TVariables>;
type _Test_Cache_EvictOptions = Cache.EvictOptions;
type _Test_Cache_ResetOptions = Cache.ResetOptions;
type _Test_Cache_ModifyOptions = Cache.ModifyOptions<Entity>;
type _Test_Cache_BatchOptions = Cache.BatchOptions<TCache, TUpdateResult>;
type _Test_Cache_ReadQueryOptions = Cache.ReadQueryOptions<TData, TVariables>;
type _Test_Cache_ReadFragmentOptions = Cache.ReadFragmentOptions<TData, TVariables>;
type _Test_Cache_WriteQueryOptions = Cache.WriteQueryOptions<TData, TVariables>;
type _Test_Cache_WriteFragmentOptions = Cache.WriteFragmentOptions<TData, TVariables>;
type _Test_Cache_UpdateQueryOptions = Cache.UpdateQueryOptions<TData, TVariables>;
type _Test_Cache_UpdateFragmentOptions = Cache.UpdateFragmentOptions<TData, TVariables>;
type _Test_Cache_DiffResult = Cache.DiffResult<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DiffQueryAgainstStoreOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DiffQueryAgainstStoreOptions} from "@apollo/client";
type _Test_DiffQueryAgainstStoreOptions = DiffQueryAgainstStoreOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FieldFunctionOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FieldFunctionOptions} from "@apollo/client";
type _Test_FieldFunctionOptions = FieldFunctionOptions<TArgs, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FieldMergeFunction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FieldMergeFunction} from "@apollo/client";
type _Test_FieldMergeFunction = FieldMergeFunction<TExisting, TIncoming, TOptions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FieldPolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FieldPolicy} from "@apollo/client";
type _Test_FieldPolicy = FieldPolicy<TExisting, TIncoming, TReadResult, TOptions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FieldReadFunction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FieldReadFunction} from "@apollo/client";
type _Test_FieldReadFunction = FieldReadFunction<TExisting, TReadResult, TOptions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("IdGetter", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {IdGetter} from "@apollo/client";
type _Test_IdGetter = IdGetter;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("IdGetterObj", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {IdGetterObj} from "@apollo/client";
type _Test_IdGetterObj = IdGetterObj;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InMemoryCacheConfig", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InMemoryCacheConfig} from "@apollo/client";
type _Test_InMemoryCacheConfig = InMemoryCacheConfig;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MergeInfo", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MergeInfo} from "@apollo/client";
type _Test_MergeInfo = MergeInfo;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MergeTree", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MergeTree} from "@apollo/client";
type _Test_MergeTree = MergeTree;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("NormalizedCache", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {NormalizedCache} from "@apollo/client";
type _Test_NormalizedCache = NormalizedCache;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("NormalizedCacheObject", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {NormalizedCacheObject} from "@apollo/client";
type _Test_NormalizedCacheObject = NormalizedCacheObject;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("OptimisticStoreItem", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {OptimisticStoreItem} from "@apollo/client";
type _Test_OptimisticStoreItem = OptimisticStoreItem;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("PossibleTypesMap", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {PossibleTypesMap} from "@apollo/client";
type _Test_PossibleTypesMap = PossibleTypesMap;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ReactiveVar", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ReactiveVar} from "@apollo/client";
type _Test_ReactiveVar = ReactiveVar<T>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ReadMergeModifyContext", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ReadMergeModifyContext} from "@apollo/client";
type _Test_ReadMergeModifyContext = ReadMergeModifyContext;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ReadQueryOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ReadQueryOptions} from "@apollo/client";
type _Test_ReadQueryOptions = ReadQueryOptions;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("StoreValue", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {StoreValue} from "@apollo/client";
type _Test_StoreValue = StoreValue;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Transaction", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Transaction} from "@apollo/client";
type _Test_Transaction = Transaction;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("TypePolicies", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {TypePolicies} from "@apollo/client";
type _Test_TypePolicies = TypePolicies;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("TypePolicy", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {TypePolicy} from "@apollo/client";
type _Test_TypePolicy = TypePolicy;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("WatchFragmentOptions", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {WatchFragmentOptions} from "@apollo/client";
type _Test_WatchFragmentOptions = WatchFragmentOptions<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("WatchFragmentResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {WatchFragmentResult} from "@apollo/client";
type _Test_WatchFragmentResult = WatchFragmentResult<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ApolloCache", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloCache} from "@apollo/client";
class _Test_ApolloCache extends ApolloCache {}
const _test_ApolloCache = new ApolloCache()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("defaultDataIdFromObject", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {defaultDataIdFromObject} from "@apollo/client";
defaultDataIdFromObject(param0, context)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("InMemoryCache", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {InMemoryCache} from "@apollo/client";
class _Test_InMemoryCache extends InMemoryCache {}
const _test_InMemoryCache = new InMemoryCache(config)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("makeVar", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {makeVar} from "@apollo/client";
makeVar<T>(value)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MissingFieldError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MissingFieldError} from "@apollo/client";
class _Test_MissingFieldError extends MissingFieldError {}
const _test_MissingFieldError = new MissingFieldError(message, path, query, variables)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ApolloLink", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloLink} from "@apollo/client";
class _Test_ApolloLink extends ApolloLink {}
const _test_ApolloLink = new ApolloLink(request)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("concat", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {concat} from "@apollo/client";
const _Test_concat = concat;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    const _Test_concat = ApolloLink.concat;"
  `);
});


test("empty", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {empty} from "@apollo/client";
const _Test_empty = empty;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    const _Test_empty = ApolloLink.empty;"
  `);
});


test("execute", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {execute} from "@apollo/client";
const _Test_execute = execute;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("from", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {from} from "@apollo/client";
const _Test_from = from;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    const _Test_from = ApolloLink.from;"
  `);
});


test("split", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {split} from "@apollo/client";
const _Test_split = split;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    const _Test_split = ApolloLink.split;"
  `);
});


test("ApolloPayloadResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ApolloPayloadResult} from "@apollo/client";
type _Test_ApolloPayloadResult = ApolloPayloadResult<TData, TExtensions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DocumentNode", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DocumentNode} from "@apollo/client";
type _Test_DocumentNode = DocumentNode;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FetchResult", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FetchResult} from "@apollo/client";
type _Test_FetchResult = FetchResult<TData, TExtensions>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    type _Test_FetchResult = ApolloLink.Result<TData, TExtensions>;"
  `);
});


test("GraphQLRequest", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {GraphQLRequest} from "@apollo/client";
type _Test_GraphQLRequest = GraphQLRequest;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    type _Test_GraphQLRequest = ApolloLink.Request;"
  `);
});


test("Operation", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Operation} from "@apollo/client";
type _Test_Operation = Operation;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    type _Test_Operation = ApolloLink.Operation;"
  `);
});


test("RequestHandler", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {RequestHandler} from "@apollo/client";
type _Test_RequestHandler = RequestHandler;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`
    "import {ApolloLink} from "@apollo/client";
    type _Test_RequestHandler = ApolloLink.RequestHandler;"
  `);
});


test("checkFetcher", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {checkFetcher} from "@apollo/client";
const _Test_checkFetcher = checkFetcher;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("createHttpLink", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {createHttpLink} from "@apollo/client";
const _Test_createHttpLink = createHttpLink;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("createSignalIfSupported", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {createSignalIfSupported} from "@apollo/client";
const _Test_createSignalIfSupported = createSignalIfSupported;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("defaultPrinter", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {defaultPrinter} from "@apollo/client";
const _Test_defaultPrinter = defaultPrinter;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("fallbackHttpConfig", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {fallbackHttpConfig} from "@apollo/client";
const _Test_fallbackHttpConfig = fallbackHttpConfig;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("HttpLink", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {HttpLink} from "@apollo/client";
class _Test_HttpLink extends HttpLink {}
const _test_HttpLink = new HttpLink(options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("parseAndCheckHttpResponse", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {parseAndCheckHttpResponse} from "@apollo/client";
parseAndCheckHttpResponse(operations)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("rewriteURIForGET", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {rewriteURIForGET} from "@apollo/client";
rewriteURIForGET(chosenURI, body)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("selectHttpOptionsAndBody", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {selectHttpOptionsAndBody} from "@apollo/client";
selectHttpOptionsAndBody(operation, fallbackConfig, configs)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("selectHttpOptionsAndBodyInternal", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {selectHttpOptionsAndBodyInternal} from "@apollo/client";
selectHttpOptionsAndBodyInternal(operation, printer, configs)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("selectURI", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {selectURI} from "@apollo/client";
const _Test_selectURI = selectURI;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("serializeFetchParameter", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {serializeFetchParameter} from "@apollo/client";
const _Test_serializeFetchParameter = serializeFetchParameter;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("ClientParseError", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {ClientParseError} from "@apollo/client";
type _Test_ClientParseError = ClientParseError;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DataMasking", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DataMasking} from "@apollo/client";
type _Test_DataMasking = DataMasking;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("FragmentType", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {FragmentType} from "@apollo/client";
type _Test_FragmentType = FragmentType<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Masked", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Masked} from "@apollo/client";
type _Test_Masked = Masked<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MaskedDocumentNode", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MaskedDocumentNode} from "@apollo/client";
type _Test_MaskedDocumentNode = MaskedDocumentNode<TData, TVariables>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("MaybeMasked", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {MaybeMasked} from "@apollo/client";
type _Test_MaybeMasked = MaybeMasked<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Unmasked", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Unmasked} from "@apollo/client";
type _Test_Unmasked = Unmasked<TData>;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DocumentTransformCacheKey", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DocumentTransformCacheKey} from "@apollo/client";
type _Test_DocumentTransformCacheKey = DocumentTransformCacheKey;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Reference", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Reference} from "@apollo/client";
type _Test_Reference = Reference;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("StoreObject", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {StoreObject} from "@apollo/client";
type _Test_StoreObject = StoreObject;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("DocumentTransform", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {DocumentTransform} from "@apollo/client";
class _Test_DocumentTransform extends DocumentTransform {}
const _test_DocumentTransform = new DocumentTransform(transform, options)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("isReference", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {isReference} from "@apollo/client";
isReference(obj)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("Observable", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {Observable} from "@apollo/client";
class _Test_Observable extends Observable<T> {}
const _test_Observable = new Observable<T>(subscribe)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("setLogVerbosity", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {setLogVerbosity} from "@apollo/client";
setLogVerbosity(level)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("disableExperimentalFragmentVariables", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {disableExperimentalFragmentVariables} from "@apollo/client";
disableExperimentalFragmentVariables()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("disableFragmentWarnings", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {disableFragmentWarnings} from "@apollo/client";
disableFragmentWarnings()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("enableExperimentalFragmentVariables", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {enableExperimentalFragmentVariables} from "@apollo/client";
enableExperimentalFragmentVariables()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("gql", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {gql} from "@apollo/client";
gql(literals, args)
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("resetCaches", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {resetCaches} from "@apollo/client";
resetCaches()
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("build", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {build} from "@apollo/client";
const _Test_build = build;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});


test("version", () => {
  expect(
    applyTransform(
      imports,
      {},
      { source: ts`
import {version} from "@apollo/client";
const _Test_version = version;
`.trim()
      },
      { parser: "ts" }
    )
  ).toMatchInlineSnapshot(`""`);
});

