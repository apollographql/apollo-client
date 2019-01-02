---
title: Apollo Client
order: 11
description: Apollo Client API reference
---

<h2 id="apollo-client">ApolloClient</h2>

The Apollo Client constructor takes a small number of options, of which two are required. These arguments make it easy to customize how Apollo works based on your environment or application needs.

- `link`: Apollo Client requires an Apollo Link to serve as the network layer. For more information about creating links, read the [docs](/docs/link).
- `cache`: The second required argument for using Apollo Client is an instance of an Apollo Cache. The recommended cache is the `apollo-cache-inmemory` which exports an `{ InMemoryCache }`. For more information read the [cache docs](../advanced/caching.html).
- `ssrMode`: When using the client for [server side rendering](../features/server-side-rendering.html), pass `ssrMode` as `true` so that React Apollo's `getDataFromTree` can work effectively.
- `ssrForceFetchDelay`: determines the time interval before Apollo Client force fetchs queries after a server side render.
- `connectToDevTools`: This argument allows the [Apollo Client Devtools](../features/developer-tooling.html) to connect to your application's Apollo Client. You can set this to be `true` to use the tools in production (they are on by default in dev mode).
- `queryDeduplication`: If set to false, this argument will force a query to still be sent to the server even if a query with identical parameters (query, variables, operationName) is already in flight.
- `name`: A custom name that can be used to identify this client, e.g. "iOS". Apollo Server leverages this property as part of its [Client Awareness](/docs/apollo-server/v2/features/metrics.html#Client-Awareness) functionality.
- `version`: A custom version that can be used to identify this client, when using Apollo client awareness features. This is the version of your client, which you may want to increment on new builds. This is NOT the version of Apollo Client that you are using. Apollo Server leverages this property as part of its [Client Awareness](/docs/apollo-server/v2/features/metrics.html#Client-Awareness) functionality.
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

The `ApolloClient` class is the core API for Apollo, and the one you'll need to  use no matter which integration you are using:

{% tsapibox ApolloClient.constructor %}
{% tsapibox ApolloClient.watchQuery %}
{% tsapibox ApolloClient.query %}
{% tsapibox ApolloClient.mutate %}
{% tsapibox ApolloClient.subscribe %}
{% tsapibox ApolloClient.readQuery %}
{% tsapibox ApolloClient.readFragment %}
{% tsapibox ApolloClient.writeQuery %}
{% tsapibox ApolloClient.writeFragment %}
{% tsapibox ApolloClient.resetStore %}
{% tsapibox ApolloClient.onResetStore %}
{% tsapibox ApolloClient.clearStore %}

<h2 id="ObservableQuery">ObservableQuery</h2>

`ApolloClient` Observables extend the Observables implementation provided by [`zen-observable`](https://github.com/zenparsing/zen-observable). Refer to the `zen-observable` documentation for additional context and API options.

{% tsapibox ObservableQuery.variables %}
{% tsapibox ObservableQuery.result %}
{% tsapibox ObservableQuery.currentResult %}
{% tsapibox ObservableQuery.refetch %}
{% tsapibox ObservableQuery.setOptions %}
{% tsapibox ObservableQuery.setVariables %}
{% tsapibox ObservableQuery.fetchMore %}
{% tsapibox ObservableQuery.updateQuery %}
{% tsapibox ObservableQuery.startPolling %}
{% tsapibox ObservableQuery.stopPolling %}
{% tsapibox ObservableQuery.subscribeToMore %}

<h2 id="types">Types</h2>

{% tsapibox ApolloClientOptions %}
{% tsapibox DefaultOptions %}
{% tsapibox NetworkStatus %}
{% tsapibox ApolloQueryResult %}
{% tsapibox ApolloCurrentResult %}
