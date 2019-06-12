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

Constructs an instance of [ApolloClient](#apolloclient).

### `watchQuery(options): ObservableQuery <, >`

This watches the cache store of the query according to the options specified and returns an [ObservableQuery][]. We can subscribe to this [ObservableQuery][] and receive updated results through a GraphQL observer when the cache store changes.

| Option                        | Type                                                                                           | Description                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `context`                     | `any`                                                                                          | Context to be passed to link execution chain                                                          |
| `errorPolicy`                 | `"none" | "ignore" | "all"`                                                                    | Specifies the ErrorPolicy to be used for this query                                                   |
| `fetchPolicy`                 | `"cache-first" | "network-only" | "cache-only" | "no-cache" | "standby" | "cache-and-network"` | Specifies the FetchPolicy to be used for this query                                                   |
| `fetchResults`                | `any`                                                                                          | Whether or not to fetch results                                                                       |
| `metadata`                    | `any`                                                                                          | Arbitrary metadata stored in the store with this query. Designed for debugging, developer tools, etc. |
| `notifyOnNetworkStatusChange` | `any`                                                                                          | Whether or not updates to the network status should trigger next on the observer of this query        |
| `pollInterval` | `any` | The time interval (in milliseconds) on which this query should be refetched from the server. |
| `query` | `DocumentNode` | A GraphQL document that consists of a single query to be sent down to the server. |
| `returnPartialData` | `any` | Allow returning incomplete data from the cache when a larger query cannot be fully satisfied by the cache, instead of returning nothing. |
| `variables` | `TVariables` | A map going from variable name to variable value, where the variables are used within the GraphQL query. |

[ObservableQuery]: #observablequery

## `ObservableQuery`

`ApolloClient` Observables extend the Observables implementation provided by [`zen-observable`](https://github.com/zenparsing/zen-observable). Refer to the `zen-observable` documentation for additional context and API options.

## Types
