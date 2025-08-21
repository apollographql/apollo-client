/**
 * This file documents exports that have been removed from Apollo Client in 4.0.
 *
 * Executing the `removals` codemod will point removed exports to this file, where
 * docblocks will explain the removal and suggest alternatives.
 */

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export declare const ApolloConsumer: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.errors:type {"name":"ApolloError"} }
 */
export declare class ApolloError {}

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.rxjs:type {"name":"Concast"} }
 *
 * Instead of `Concast`, look into the `rxjs` [`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) api.
 */
export declare class Concast {}

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"DataProxy"} }
 *
 * You can find the types that were previously available in the `DataProxy` namespace either in the `ApolloClient` namespace or the `Cache` namespace.
 */
export declare const DataProxy: never;

/**
 * @deprecated The `DocumentType` enum has been removed from Apollo Client 4.0, along with the `parser` API exported from `@apollo/client/react/parser`.
 *
 * This API was mostly an implementation detail and has been removed without replacement.
 */
export declare const DocumentType: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.renderProp:type }
 */
export declare const Mutation: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.rxjs:type {"name":"ObservableSubscription"} }
 */
export declare const ObservableSubscription: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.rxjs:type {"name":"Observer"} }
 */
export declare const Observer: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"OperationBatcher", "of": "`BatchLink`"} }
 */
export declare const OperationBatcher: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.renderProp:type }
 */
export declare const Query: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"RenderPromises", "of": "`getMarkupFromTree`"} }
 */
export declare const RenderPromises: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.rxjs:type {"name":"Subscription"} }
 */
export declare const Subscription: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"addNonReactiveToNamedFragments", "of": "the internal `QueryManager` class"} }
 */
export declare const addNonReactiveToNamedFragments: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.rxjs:type {"name":"asyncMap"} }
 *
 * Consider using the `rxjs` [`mergeMap`](https://rxjs.dev/api/operators/mergeMap) operator instead.
 */
export declare const asyncMap: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"buildQueryFromSelectionSet"} }
 */
export declare const buildQueryFromSelectionSet: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"canUseAsyncIteratorSymbol"} }
 */
export declare const canUseAsyncIteratorSymbol: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"canUseLayoutEffect"} }
 */
export declare const canUseLayoutEffect: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"canUseSymbol"} }
 */
export declare const canUseSymbol: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"canUseWeakMap"} }
 */
export declare const canUseWeakMap: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"canUseWeakSet"} }
 */
export declare const canUseWeakSet: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedValue:type {"name":"createMockClient"} }
 *
 * Please create an `ApolloClient` instance with a `MockLink` manually instead.
 */
export declare const createMockClient: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.testingLibrary:type {"name":"createSchemaFetch"} }
 */
export declare const createSchemaFetch: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.testingLibrary:type {"name":"createTestSchema"} }
 */
export declare const createTestSchema: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internal:type {"name":"defaultCacheSizes"} }
 */
export declare const defaultCacheSizes: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"fixObservableSubclass","of":"ObservableQuery"} }
 */
export declare const fixObservableSubclass: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.rxjs:type {"name":"fromError"} }
 */
export declare const fromError: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.rxjs:type {"name":"fromPromise"} }
 */
export declare const fromPromise: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"getDirectiveNames"} }
 */
export declare const getDirectiveNames: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"getFragmentMaskMode","of":"data masking"} }
 */
export declare const getFragmentMaskMode: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"getInclusionDirectives","of":"local state"} }
 */
export declare const getInclusionDirectives: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"getTypenameFromResult","of":"`InMemoryCache`"} }
 */
export declare const getTypenameFromResult: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export declare const graphql: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"hasAllDirectives"} }
 */
export declare const hasAllDirectives: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"hasAnyDirectives"} }
 */
export declare const hasAnyDirectives: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"hasClientExports"} }
 */
export declare const hasClientExports: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.errors:type {"name":"isApolloError"} }
 */
export declare const isApolloError: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"isApolloPayloadResult","of":"HttpLink"} }
 */
export declare const isApolloPayloadResult: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.defer:type {"name":"isExecutionPatchIncrementalResult"} }
 */
export declare const isExecutionPatchIncrementalResult: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.defer:type {"name":"isExecutionPatchInitialResult"} }
 */
export declare const isExecutionPatchInitialResult: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.defer:type {"name":"isExecutionPatchResult"} }
 */
export declare const isExecutionPatchResult: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"isFullyUnmaskedOperation","of":"data masking"} }
 */
export declare const isFullyUnmaskedOperation: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"isInlineFragment"} }
 */
export declare const isInlineFragment: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"isStatefulPromise"} }
 */
export declare const isStatefulPromise: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"itAsync"} }
 */
export declare const itAsync: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"iterateObserversSafely"} }
 */
export declare const iterateObserversSafely: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.defer:type {"name":"mergeIncrementalData"} }
 */
export declare const mergeIncrementalData: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedValue:type {"name":"mockObservableLink"} }
 */
export declare const mockObservableLink: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedValue:type {"name":"mockSingleLink"} }
 *
 * This utility was a wrapper around `MockLink`.
 * Please call `new MockLink(mockedResponses)` directly.
 */
export declare const mockSingleLink: never;

/**
 * @deprecated The `operationName` function has been removed from Apollo Client 4.0, along with the `parser` API exported from `@apollo/client/react/parser`.
 *
 * This API was mostly an implementation detail and has been removed without replacement.
 */
export declare const operationName: never;

/**
 * @deprecated The `parser` function has been removed from Apollo Client 4.0, along with the whole `@apollo/client/react/parser` entry point.
 *
 * This API was mostly an implementation detail and has been removed without replacement.
 */
export declare const parser: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"removeArgumentsFromDocument"} }
 */
export declare const removeArgumentsFromDocument: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"removeClientSetsFromDocument"} }
 */
export declare const removeClientSetsFromDocument: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"removeConnectionDirectiveFromDocument"} }
 */
export declare const removeConnectionDirectiveFromDocument: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"removeFragmentSpreadFromDocument"} }
 */
export declare const removeFragmentSpreadFromDocument: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedValue:type {"name":"resetApolloContext"} }
 *
 * This function was deprecated and is no longer available.
 */
export declare const resetApolloContext: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"serializeFetchParameter","of":"HttpLink"} }
 *
 * Please use `JSON.stringify` instead.
 */
export declare const serializeFetchParameter: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"subscribeAndCount"} }
 */
export declare const subscribeAndCount: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"throwServerError","of":"HttpLink"} }
 *
 * Please instantiate a `ServerError` directly instead.
 */
export declare const throwServerError: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"tick"} }
 */
export declare const tick: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.rxjs:type {"name":"toPromise"} }
 *
 * Please use the `rxjs` [`firstValueFrom`](https://rxjs.dev/api/index/function/firstValueFrom) or [`lastValueFrom`](https://rxjs.dev/api/index/function/lastValueFrom) functions instead.
 */
export declare const toPromise: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"transformOperation","of":"ApolloLink.execute"} }
 */
export declare const transformOperation: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"validateOperation","of":"ApolloLink.execute"} }
 */
export declare const validateOperation: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internal:type {"name":"valueToObjectRepresentation"} }
 */
export declare const valueToObjectRepresentation: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internal:type {"name":"verifyDocumentType"} }
 */
export declare const verifyDocumentType: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"wait"} }
 */
export declare const wait: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export declare const withApollo: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"withErrorSpy"} }
 */
export declare const withErrorSpy: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"withLogSpy"} }
 */
export declare const withLogSpy: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export declare const withMutation: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export declare const withQuery: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export declare const withSubscription: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"withWarningSpy"} }
 */
export declare const withWarningSpy: never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.renderProp:type }
 */
export type ApolloConsumerProps = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.errors:type {"name":"ApolloErrorOptions"} }
 */
export type ApolloErrorOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"BaseMutationOptions"} }
 *
 * Look into `ApolloClient.MutateOptions` or `useMutation.Options` instead.
 */
export type BaseMutationOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"BaseQueryOptions"} }
 *
 * Look into `ApolloClient.QueryOptions` or `useQuery.Options` instead.
 */
export type BaseQueryOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"BatchableRequest"} }
 */
export type BatchableRequest = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type ChildDataProps = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type ChildMutateProps = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type ChildProps = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.errors:type {"name":"ClientParseError"} }
 */
export type ClientParseError = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"Masked"} }
 */
export type Masked = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"MaskedDocumentNode"} }
 */
export type MaskedDocumentNode = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"CommonOptions"} }
 */
export type CommonOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"ConcastSourcesArray"} }
 */
export type ConcastSourcesArray = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"ConcastSourcesIterable"} }
 */
export type ConcastSourcesIterable = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"DataProps"} }
 */
export type DataProps = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type DataValue = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"DirectiveInfo"} }
 */
export type DirectiveInfo = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"Directives"} }
 */
export type Directives = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"FetchMoreQueryOptions"} }
 *
 * Look into `ObservableQuery.FetchMoreOptions` instead.
 */
export type FetchMoreQueryOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"FragmentMatcher"} }
 */
export type FragmentMatcher = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"GetDirectiveConfig"} }
 */
export type GetDirectiveConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"GetFragmentSpreadConfig"} }
 */
export type GetFragmentSpreadConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"GetNodeConfig"} }
 */
export type GetNodeConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.errors:type {"name":"GraphQLErrors"} }
 */
export type GraphQLErrors = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"IDocumentDefinition"} }
 */
export type IDocumentDefinition = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"InclusionDirectives"} }
 */
export type InclusionDirectives = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internalTesting:type {"name":"IsStrictlyAny"} }
 */
export type IsStrictlyAny = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"MethodKeys"} }
 */
export type MethodKeys = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type MutateProps = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.renderProp:type }
 */
export type MutationComponentOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"MutationDataOptions"} }
 *
 * Look into `ApolloClient.MutateOptions` or `useMutation.Options` instead.
 */
export type MutationDataOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"MutationUpdaterFn"} }
 */
export type MutationUpdaterFn = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.errors:type {"name":"NetworkError"} }
 */
export type NetworkError = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internal:type {"name":"ObservableQueryFields"} }
 */
export type ObservableQueryFields = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internal:type {"name":"OnlyRequiredProperties"} }
 */
export type OnlyRequiredProperties = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type OperationOption = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type OptionProps = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internal:type {"name":"PromiseWithState"} }
 */
export type PromiseWithState = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"PureQueryOptions"} }
 */
export type PureQueryOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.renderProp:type }
 */
export type QueryComponentOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type QueryControls = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"QueryDataOptions","of":"`getMarkupFromTree`"} }
 */
export type QueryDataOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"QueryLazyOptions"} }
 */
export type QueryLazyOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.internal:type {"name":"ReconcilerFunction"} }
 */
export type ReconcilerFunction = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"RefetchQueriesFunction"} }
 *
 * Look into using `useMutation.Options['refetchQueries']` instead.
 */
export type RefetchQueriesFunction = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"RemoveArgumentsConfig"} }
 */
export type RemoveArgumentsConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"RemoveDirectiveConfig"} }
 */
export type RemoveDirectiveConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"RemoveFragmentDefinitionConfig"} }
 */
export type RemoveFragmentDefinitionConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"RemoveFragmentSpreadConfig"} }
 */
export type RemoveFragmentSpreadConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"RemoveNodeConfig"} }
 */
export type RemoveNodeConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"RemoveVariableDefinitionConfig"} }
 */
export type RemoveVariableDefinitionConfig = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"Resolver","of":"local state"} }
 */
export type Resolver = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.implementationDetail:type {"name":"Resolvers","of":"local state"} }
 */
export type Resolvers = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.renderProp:type }
 */
export type SubscriptionComponentOptions = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"SubscriptionCurrentObservable"} }
 */
export type SubscriptionCurrentObservable = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"TupleToIntersection"} }
 */
export type TupleToIntersection = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.utility:type {"name":"UnionToIntersection"} }
 */
export type UnionToIntersection = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.removedType:type {"name":"VariableValue"} }
 */
export type VariableValue = never;

/**
 * {@inheritDoc @apollo/client/v4-migration!Removals.HOC:type }
 */
export type WithApolloClient = never;

export declare namespace Removals {
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   */
  export type removedValue = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   */
  export type removedType = never;
  /**
   * @deprecated All higher-order components (HOCs) have been removed from Apollo Client 4.0 and are no longer available.
   * Use the hooks exported from the `@apollo/client/react` package instead.
   */
  export type HOC = never;
  /**
   * @deprecated All render prop components have been removed from Apollo Client 4.0 and are no longer available.
   * Use the hooks exported from the `@apollo/client/react` package instead.
   */
  export type renderProp = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   *
   * Error handling has been overhauled as a whole.
   */
  export type errors = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   *
   * The Observable implementation of Apollo Client has been moved from `zen-observable` to `rxjs`.
   */
  export type rxjs = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   *
   * This export was an implementation detail of \{\{of\}\} and is no longer available.
   */
  export type implementationDetail = never;
  /**
   * @deprecated The utility `{{name}}` has been removed from Apollo Client 4.0.
   *
   * It was an implementation detail that is no longer necessary and has been removed without replacement.
   */
  export type utility = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   *
   * The testing utilities have moved into their own package, [\@apollo/graphql-testing-library](https://github.com/apollographql/graphql-testing-library).
   */
  export type testingLibrary = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   *
   * This export is considered internal and is no longer exposed.
   */
  export type internal = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   *
   * This was an internal testing utility that was not meant for public use.
   * It has been removed without replacement.
   */
  export type internalTesting = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   *
   * This export was part of a specific `\@defer` protocol implementation.
   * These implementations are now pluggable, so this export might not be relevant for all protocol specifications.
   */
  export type defer = never;
}
