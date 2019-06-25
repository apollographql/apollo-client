---
title: Apollo Client
order: 11
description: Apollo Client API reference
---

## `ApolloClient`

The Apollo Client constructor takes a small number of options, of which two are required. These arguments make it easy to customize how Apollo works based on your environment or application needs.

- `link`: Apollo Client requires an Apollo Link to serve as the network layer. For more information about creating links, read the [docs](https://www.apollographql.com/docs/link/).
- `cache`: The second required argument for using Apollo Client is an instance of an Apollo Cache. The recommended cache is the `apollo-cache-inmemory` which exports an `{ InMemoryCache }`. For more information read the [cache docs](/advanced/caching/).
- `ssrMode`: When using the client for [server side rendering](/features/server-side-rendering/), pass `ssrMode` as `true` so that React Apollo's `getDataFromTree` can work effectively.
- `ssrForceFetchDelay`: determines the time interval before Apollo Client force fetchs queries after a server side render.
- `connectToDevTools`: This argument allows the [Apollo Client Devtools](/features/developer-tooling/) to connect to your application's Apollo Client. You can set this to be `true` to use the tools in production (they are on by default in dev mode).
- `queryDeduplication`: If set to false, this argument will force a query to still be sent to the server even if a query with identical parameters (query, variables, operationName) is already in flight.
- `name`: A custom name that can be used to identify this client, e.g. "iOS". Apollo Server leverages this property as part of its [Client Awareness](https://www.apollographql.com/docs/apollo-server/v2/features/metrics#Client-Awareness) functionality.
- `version`: A custom version that can be used to identify this client, when using Apollo client awareness features. This is the version of your client, which you may want to increment on new builds. This is NOT the version of Apollo Client that you are using. Apollo Server leverages this property as part of its [Client Awareness](https://www.apollographql.com/docs/apollo-server/v2/features/metrics#Client-Awareness) functionality.
- `defaultOptions`: If you want to set application wide defaults for the options supplied to `watchQuery`, `query`, or `mutate`, you can pass them as a `defaultOptions` object. An example object looks like this:

```js
const defaultOptions = {
  watchQuery: {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'ignore',
  },
  query: {
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
  },
  mutate: {
    errorPolicy: 'all'
  }
}
```

These options will be merged with options supplied with each request.

> **Note:** The React Apollo `<Query />` component uses Apollo Client's `watchQuery` functionality, so if you would like to set `defaultOptions` when using `<Query />`, be sure to set them under the `defaultOptions.watchQuery` property.

The `ApolloClient` class is the core API for Apollo, and the one you'll need to use no matter which integration you are using:

### `constructor`

Constructs an instance of [ApolloClient][].

### `watchQuery(options): ObservableQuery <, >`

This watches the cache store of the query according to the options specified and returns an [ObservableQuery][]. We can subscribe to this [ObservableQuery][] and receive updated results through a GraphQL observer when the cache store changes.

| Option                        | Type                                                                                                                  | Description                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                     | any                                                                                                                   | Context to be passed to link execution chain                                                                                             |
| `errorPolicy`                 | "none" &#124; "ignore" &#124; "all"                                                                                   | Specifies the ErrorPolicy to be used for this query                                                                                      |
| `fetchPolicy`                 | "cache-first" &#124; "network-only" &#124; "cache-only" &#124; "no-cache" &#124; "standby" &#124; "cache-and-network" | Specifies the FetchPolicy to be used for this query                                                                                      |
| `fetchResults`                | any                                                                                                                   | Whether or not to fetch results                                                                                                          |
| `metadata`                    | any                                                                                                                   | Arbitrary metadata stored in the store with this query. Designed for debugging, developer tools, etc.                                    |
| `notifyOnNetworkStatusChange` | any                                                                                                                   | Whether or not updates to the network status should trigger next on the observer of this query                                           |
| `pollInterval`                | any                                                                                                                   | The time interval (in milliseconds) on which this query should be refetched from the server.                                             |
| `query`                       | DocumentNode                                                                                                          | A GraphQL document that consists of a single query to be sent down to the server.                                                        |
| `returnPartialData`           | any                                                                                                                   | Allow returning incomplete data from the cache when a larger query cannot be fully satisfied by the cache, instead of returning nothing. |
| `variables`                   | TVariables                                                                                                            | A map going from variable name to variable value, where the variables are used within the GraphQL query.                                 |

### `query(options): Promise<ApolloQueryResult>`

This resolves a single query according to the options specified and returns a Promise which is either resolved with the resulting data or rejected with an error.

| Option         | Type                                                                                       | Description                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `context`      | any                                                                                        | Context to be passed to link execution chain                                                             |
| `errorPolicy`  | "none" &#124; "ignore" &#124; "all"                                                        | Specifies the ErrorPolicy to be used for this query                                                      |
| `fetchPolicy`  | "cache-first" &#124; "network-only" &#124; "cache-only" &#124; "no-cache" &#124; "standby" | Specifies the FetchPolicy to be used for this query                                                      |
| `fetchResults` | any                                                                                        | Whether or not to fetch results                                                                          |
| `metadata`     | any                                                                                        | Arbitrary metadata stored in the store with this query. Designed for debugging, developer tools, etc.    |
| `query`        | DocumentNode                                                                               | A GraphQL document that consists of a single query to be sent down to the server.                        |
| `variables`    | TVariables                                                                                 | A map going from variable name to variable value, where the variables are used within the GraphQL query. |

### `mutate(options): Promise<FetchResult>`

This resolves a single mutation according to the options specified and returns a Promise which is either resolved with the resulting data or rejected with an error.

| Option                | Type                                                                                       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `awaitRefetchQueries` | any                                                                                        | By default, `refetchQueries` does not wait for the refetched queries to be completed, before resolving the mutation `Promise`. This ensures that query refetching does not hold up mutation response handling (query refetching is handled asynchronously). Set `awaitRefetchQueries` to `true` if you would like to wait for the refetched queries to complete, before the mutation can be marked as resolved.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `context`             | any                                                                                        | The context to be passed to the link execution chain. This context will only be used with the mutation. It will not be used with `refetchQueries`. Refetched queries use the context they were initialized with (since the intitial context is stored as part of the `ObservableQuery` instance). If a specific context is needed when refetching queries, make sure it is configured (via the query context option) when the query is first initialized/run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `errorPolicy`         | "none" &#124; "ignore" &#124; "all"                                                        | Specifies the ErrorPolicy to be used for this operation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `fetchPolicy`         | "cache-first" &#124; "network-only" &#124; "cache-only" &#124; "no-cache" &#124; "standby" | Specifies the FetchPolicy to be used for this query                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `mutation`            | DocumentNode                                                                               | A GraphQL document, often created with `gql` from the `graphql-tag` package, that contains a single mutation inside of it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `optimisticResponse`  | any                                                                                        | An object that represents the result of this mutation that will be optimistically stored before the server has actually returned a result. This is most often used for optimistic UI, where we want to be able to see the result of a mutation immediately, and update the UI later if any errors appear.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `refetchQueries`      | any                                                                                        | A list of query names which will be refetched once this mutation has returned. This is often used if you have a set of queries which may be affected by a mutation and will have to update. Rather than writing a mutation query reducer (i.e. `updateQueries`) for this, you can simply refetch the queries that will be affected and achieve a consistent store once these queries return.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `update`              | (DataProxy, FetchResult<>) => any<>                                                        | This function will be called twice over the lifecycle of a mutation. Once at the very beginning if an `optimisticResponse` was provided. The writes created from the optimistic data will be rolled back before the second time this function is called which is when the mutation has succesfully resolved. At that point `update` will be called with the actual mutation result and those writes will not be rolled back. The reason a DataProxy is provided instead of the user calling the methods directly on ApolloClient is that all of the writes are batched together at the end of the update, and it allows for writes generated by optimistic data to be rolled back. Note that since this function is intended to be used to update the store, it cannot be used with a `no-cache` fetch policy. If you're interested in performing some action after a mutation has completed, and you don't need to update the store, use the Promise returned from `client.mutate` instead. |
| `updateQueries`       | \[queryName:undefined\]:(Record<, >, any) => Record<, ><><>                                | A MutationQueryReducersMap, which is map from query names to mutation query reducers. Briefly, this map defines how to incorporate the results of the mutation into the results of queries that are currently being watched by your application.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `variables`           | TVariables                                                                                 | An object that maps from the name of a variable as used in the mutation GraphQL document to that variable's value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### `subscribe(options): Observable<FetchResult>`

This subscribes to a graphql subscription according to the options specified and returns an Observable which either emits received data or an error.

| Option        | Type                                                                                       | Description                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `fetchPolicy` | "cache-first" &#124; "network-only" &#124; "cache-only" &#124; "no-cache" &#124; "standby" | Specifies the FetchPolicy to be used for this subscription.                                                                    |
| `query`       | DocumentNode                                                                               | A GraphQL document, often created with `gql` from the `graphql-tag` package, that contains a single subscription inside of it. |
| `variables`   | TVariables                                                                                 | An object that maps from the name of a variable as used in the subscription GraphQL document to that variable's value.         |

### `readQuery(options, optimistic): any`

Tries to read some data from the store in the shape of the provided GraphQL query without making a network request. This method will start at the root query. To start at a specific id returned by `dataIdFromObject` use `readFragment`.

| Option       | Type | Description                                                                           |
| ------------ | ---- | ------------------------------------------------------------------------------------- |
| `optimistic` | any  | Set to `true` to allow `readQuery` to return optimistic results. Is false by default. |

### `readFragment(options, optimistic): any`

Tries to read some data from the store in the shape of the provided GraphQL fragment without making a network request. This method will read a GraphQL fragment from any arbitrary id that is currently cached, unlike `readQuery` which will only read from the root query.

| Option       | Type | Description                                                                                |
| ------------ | ---- | ------------------------------------------------------------------------------------------ |
| `optimistic` | any  | Set to `true` to allow `readFragment` to return optimistic results. Is `false` by default. |

### `writeQuery(options): any`

Writes some data in the shape of the provided GraphQL query directly to the store. This method will start at the root query. To start at a specific id returned by `dataIdFromObject` then use `writeFragment`.

### `writeFragment(options): any`

Writes some data in the shape of the provided GraphQL fragment directly to the store. This method will write to a GraphQL fragment from any arbitrary id that is currently cached, unlike `writeQuery` which will only write from the root query.

### `resetStore(): Promise<>`

Resets your entire store by clearing out your cache and then re-executing all of your active queries. This makes it so that you may guarantee that there is no data left in your store from a time before you called this method.

### `onResetStore(cb): () => any`

Allows callbacks to be registered that are executed when the store is reset. `onResetStore` returns an unsubscribe function that can be used to remove registered callbacks.

| Argument | Type            |
| -------- | --------------- |
| `cb`     | () => Promise<> |

### `clearStore(): Promise<>`

Remove all data from the store. Unlike `resetStore`, `clearStore` will not refetch any active queries.

### `onClearStore(cb): () => any`

Allows callbacks to be registered that are executed when the store is cleared. `onClearStore` returns an unsubscribe function that can be used to remove registered callbacks.

| Argument | Type            |
| -------- | --------------- |
| `cb`     | () => Promise<> |

### `stop(): any`

Call this method to terminate any active client processes, making it safe to dispose of this `ApolloClient` instance.

### `reFetchObservableQueries(includeStandby): Promise<>`

Refetches all of your active queries.

| Argument         | Type |
| ---------------- | ---- |
| `includeStandby` | any  |

## `ObservableQuery`

`ApolloClient` Observables extend the Observables implementation provided by [`zen-observable`](https://github.com/zenparsing/zen-observable). Refer to the `zen-observable` documentation for additional context and API options.

## Types

[ApolloClient]: #apolloclient
[ObservableQuery]: #observablequery
