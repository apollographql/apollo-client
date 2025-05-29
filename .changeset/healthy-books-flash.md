---
"@apollo/client": major
---

The `TData` generic provided to types that return a `dataState` property is now modified by the given `DataState` generic instead of passing a modified `TData` type. For example, a `QueryRef` that could return partial data was defined as `QueryRef<DeepPartial<TData>, TVariables>`. Now `TData` should be provided unmodified and a set of allowed states should be given instead: `QueryRef<TData, TVariables, 'complete' | 'streaming' | 'partial'>`.

To migrate, use the following guide to replace your type with the right set of states (all types listed below are changed the same way):

```diff
- QueryRef<TData, TVariables>
// `QueryRef`'s default is 'complete' | 'streaming' so this can also be left alone if you prefer
// All other types affected by this change default to all states
+ QueryRef<TData, TVariables>
+ QueryRef<TData, TVariables, 'complete' | 'streaming'>

- QueryRef<TData | undefined, TVariables>
+ QueryRef<TData, TVariables, 'complete' | 'streaming' | 'empty'>

- QueryRef<DeepPartial<TData>, TVariables>
+ QueryRef<TData, TVariables, 'complete' | 'streaming' | 'partial'>

- QueryRef<DeepPartial<TData> | undefined, TVariables>
+ QueryRef<TData, TVariables, 'complete' | 'streaming' | 'partial' | 'empty'>
```

The following types are affected. Provide the allowed `dataState` values to the `TDataState` generic:
- `ApolloQueryResult`
- `QueryRef`
- `PreloadedQueryRef`
- `useLazyQuery.Result`
- `useQuery.Result`
- `useReadQuery.Result`
- `useSuspenseQuery.Result`
