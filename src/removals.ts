/**
 * This file documents exports that have been removed from Apollo Client in 4.0.
 *
 * Executing the `removals` codemod will point removed exports to this file, where
 * docblocks will explain the removal and suggest alternatives.
 */

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
   * This export was an implementation detail of {{of}} and is no longer available.
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
   * The testing utilities have moved into their own package, [@apollo/graphql-testing-library](https://github.com/apollographql/graphql-testing-library).
   */
  export type testingLibrary = never;
  /**
   * @deprecated The export `{{name}}` has been removed from Apollo Client 4.0.
   *
   * This export is considered internal and is no longer exposed.
   */
  export type internal = never;
}

/**
 * {@inheritDoc @apollo/client/removals!Removals.HOC:type }
 */
export declare const ApolloConsumer: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.errors:type {"name":"ApolloError"} }
 */
export declare const ApolloError: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.rxjs:type {"name":"Concast"} }
 *
 * Instead of `Concast`, look into the `rxjs` [`BehaviorSubject`](https://rxjs.dev/api/index/class/BehaviorSubject) api.
 */
export declare const Concast: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"DataProxy"} }
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
 * {@inheritDoc @apollo/client/removals!Removals.renderProp:type }
 */
export declare const Mutation: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.rxjs:type {"name":"ObservableSubscription"} }
 */
export declare const ObservableSubscription: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.rxjs:type {"name":"Observer"} }
 */
export declare const Observer: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.implementationDetail:type {"name":"OperationBatcher", "of": "`BatchLink`"} }
 */
export declare const OperationBatcher: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.renderProp:type }
 */
export declare const Query: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.implementationDetail:type {"name":"RenderPromises", "of": "`getMarkupFromTree`"} }
 */
export declare const RenderPromises: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.rxjs:type {"name":"Subscription"} }
 */
export declare const Subscription: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.implementationDetail:type {"name":"addNonReactiveToNamedFragments", "of": "the internal `QueryManager` class"} }
 */
export declare const addNonReactiveToNamedFragments: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.rxjs:type {"name":"asyncMap"} }
 *
 * Consider using the `rxjs` [`mergeMap`](https://rxjs.dev/api/operators/mergeMap) operator instead.
 */
export declare const asyncMap: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.utility:type {"name":"buildQueryFromSelectionSet"} }
 */
export declare const buildQueryFromSelectionSet: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.utility:type {"name":"canUseAsyncIteratorSymbol"} }
 */
export declare const canUseAsyncIteratorSymbol: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.utility:type {"name":"canUseLayoutEffect"} }
 */
export declare const canUseLayoutEffect: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.utility:type {"name":"canUseSymbol"} }
 */
export declare const canUseSymbol: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.utility:type {"name":"canUseWeakMap"} }
 */
export declare const canUseWeakMap: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.utility:type {"name":"canUseWeakSet"} }
 */
export declare const canUseWeakSet: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"createMockClient"} }
 *
 * Please create an `ApolloClient` instance with a `MockLink` manually instead.
 */
export declare const createMockClient: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.testingLibrary:type {"name":"createSchemaFetch"} }
 */
export declare const createSchemaFetch: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.testingLibrary:type {"name":"createTestSchema"} }
 */
export declare const createTestSchema: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.internal:type {"name":"defaultCacheSizes"} }
 */
export declare const defaultCacheSizes: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.implementationDetail:type {"name":"fixObservableSubclass","of":"ObservableQuery"} }
 */
export declare const fixObservableSubclass: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.rxjs:type {"name":"fromError"} }
 */
export declare const fromError: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.rxjs:type {"name":"fromPromise"} }
 */
export declare const fromPromise: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"getDirectiveNames"} }
 */
export declare const getDirectiveNames: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"getFragmentMaskMode"} }
 */
export declare const getFragmentMaskMode: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"getInclusionDirectives"} }
 */
export declare const getInclusionDirectives: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"getTypenameFromResult"} }
 */
export declare const getTypenameFromResult: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.HOC:type }
 */
export declare const graphql: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"hasAllDirectives"} }
 */
export declare const hasAllDirectives: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"hasAnyDirectives"} }
 */
export declare const hasAnyDirectives: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"hasClientExports"} }
 */
export declare const hasClientExports: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"isApolloError"} }
 */
export declare const isApolloError: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"isApolloPayloadResult"} }
 */
export declare const isApolloPayloadResult: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"isExecutionPatchIncrementalResult"} }
 */
export declare const isExecutionPatchIncrementalResult: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"isExecutionPatchInitialResult"} }
 */
export declare const isExecutionPatchInitialResult: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"isExecutionPatchResult"} }
 */
export declare const isExecutionPatchResult: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"isFullyUnmaskedOperation"} }
 */
export declare const isFullyUnmaskedOperation: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"isInlineFragment"} }
 */
export declare const isInlineFragment: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"isStatefulPromise"} }
 */
export declare const isStatefulPromise: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"itAsync"} }
 */
export declare const itAsync: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"iterateObserversSafely"} }
 */
export declare const iterateObserversSafely: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"mergeIncrementalData"} }
 */
export declare const mergeIncrementalData: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"mockObservableLink"} }
 */
export declare const mockObservableLink: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"mockSingleLink"} }
 */
export declare const mockSingleLink: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"operationName"} }
 */
export declare const operationName: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"parser"} }
 */
export declare const parser: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"removeArgumentsFromDocument"} }
 */
export declare const removeArgumentsFromDocument: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"removeClientSetsFromDocument"} }
 */
export declare const removeClientSetsFromDocument: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"removeConnectionDirectiveFromDocument"} }
 */
export declare const removeConnectionDirectiveFromDocument: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"removeFragmentSpreadFromDocument"} }
 */
export declare const removeFragmentSpreadFromDocument: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"resetApolloContext"} }
 */
export declare const resetApolloContext: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"serializeFetchParameter"} }
 */
export declare const serializeFetchParameter: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"subscribeAndCount"} }
 */
export declare const subscribeAndCount: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"throwServerError"} }
 */
export declare const throwServerError: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"tick"} }
 */
export declare const tick: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"toPromise"} }
 */
export declare const toPromise: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"transformOperation"} }
 */
export declare const transformOperation: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"validateOperation"} }
 */
export declare const validateOperation: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"valueToObjectRepresentation"} }
 */
export declare const valueToObjectRepresentation: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"verifyDocumentType"} }
 */
export declare const verifyDocumentType: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"wait"} }
 */
export declare const wait: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.HOC:type }
 */
export declare const withApollo: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"withErrorSpy"} }
 */
export declare const withErrorSpy: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"withLogSpy"} }
 */
export declare const withLogSpy: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"withMutation"} }
 */
export declare const withMutation: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"withQuery"} }
 */
export declare const withQuery: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"withSubscription"} }
 */
export declare const withSubscription: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedValue:type {"name":"withWarningSpy"} }
 */
export declare const withWarningSpy: never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ApolloConsumerProps"} }
 */
export type ApolloConsumerProps = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ApolloErrorOptions"} }
 */
export type ApolloErrorOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"BaseMutationOptions"} }
 */
export type BaseMutationOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"BaseQueryOptions"} }
 */
export type BaseQueryOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"BatchableRequest"} }
 */
export type BatchableRequest = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ChildDataProps"} }
 */
export type ChildDataProps = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ChildMutateProps"} }
 */
export type ChildMutateProps = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ChildProps"} }
 */
export type ChildProps = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ClientParseError"} }
 */
export type ClientParseError = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"CommonOptions"} }
 */
export type CommonOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ConcastSourcesArray"} }
 */
export type ConcastSourcesArray = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ConcastSourcesIterable"} }
 */
export type ConcastSourcesIterable = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"DataProps"} }
 */
export type DataProps = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"DataValue"} }
 */
export type DataValue = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"DirectiveInfo"} }
 */
export type DirectiveInfo = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"Directives"} }
 */
export type Directives = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"FetchMoreQueryOptions"} }
 */
export type FetchMoreQueryOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"FragmentMatcher"} }
 */
export type FragmentMatcher = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"GetDirectiveConfig"} }
 */
export type GetDirectiveConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"GetFragmentSpreadConfig"} }
 */
export type GetFragmentSpreadConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"GetNodeConfig"} }
 */
export type GetNodeConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"GraphQLErrors"} }
 */
export type GraphQLErrors = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"IDocumentDefinition"} }
 */
export type IDocumentDefinition = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"InclusionDirectives"} }
 */
export type InclusionDirectives = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"IsStrictlyAny"} }
 */
export type IsStrictlyAny = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"MethodKeys"} }
 */
export type MethodKeys = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"MutateProps"} }
 */
export type MutateProps = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"MutationComponentOptions"} }
 */
export type MutationComponentOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"MutationDataOptions"} }
 */
export type MutationDataOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"MutationUpdaterFn"} }
 */
export type MutationUpdaterFn = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"NetworkError"} }
 */
export type NetworkError = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ObservableQueryFields"} }
 */
export type ObservableQueryFields = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"OnlyRequiredProperties"} }
 */
export type OnlyRequiredProperties = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"OperationOption"} }
 */
export type OperationOption = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"OptionProps"} }
 */
export type OptionProps = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"PromiseWithState"} }
 */
export type PromiseWithState = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"PureQueryOptions"} }
 */
export type PureQueryOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"QueryComponentOptions"} }
 */
export type QueryComponentOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"QueryControls"} }
 */
export type QueryControls = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"QueryDataOptions"} }
 */
export type QueryDataOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"QueryLazyOptions"} }
 */
export type QueryLazyOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"ReconcilerFunction"} }
 */
export type ReconcilerFunction = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"RefetchQueriesFunction"} }
 */
export type RefetchQueriesFunction = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"RemoveArgumentsConfig"} }
 */
export type RemoveArgumentsConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"RemoveDirectiveConfig"} }
 */
export type RemoveDirectiveConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"RemoveFragmentDefinitionConfig"} }
 */
export type RemoveFragmentDefinitionConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"RemoveFragmentSpreadConfig"} }
 */
export type RemoveFragmentSpreadConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"RemoveNodeConfig"} }
 */
export type RemoveNodeConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"RemoveVariableDefinitionConfig"} }
 */
export type RemoveVariableDefinitionConfig = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"Resolver"} }
 */
export type Resolver = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"Resolvers"} }
 */
export type Resolvers = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"SubscriptionComponentOptions"} }
 */
export type SubscriptionComponentOptions = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"SubscriptionCurrentObservable"} }
 */
export type SubscriptionCurrentObservable = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"TupleToIntersection"} }
 */
export type TupleToIntersection = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"UnionToIntersection"} }
 */
export type UnionToIntersection = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"VariableValue"} }
 */
export type VariableValue = never;

/**
 * {@inheritDoc @apollo/client/removals!Removals.removedType:type {"name":"WithApolloClient"} }
 */
export type WithApolloClient = never;
