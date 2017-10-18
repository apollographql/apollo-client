---
sidebar_title: "graphql: Queries"
title: "API: graphql container with queries"
---

> This article is specifically about using queries with the `graphql()` higher order component. To see options that apply to all operations, see the [general graphql container API docs](/react/api-graphql.html).

The operation that you pass into your `graphql()` function decides how your component will behave. If you pass a query into your `graphql()` function then your component will fetch that query and reactively listen to updates for the query in the store.

An example component using a query with the `graphql()` function:

```js
export default graphql(gql`
  query TodoAppQuery {
    todos {
      id
      text
    }
  }
`)(TodoApp);

function TodoApp({ data: { todos } }) {
  return (
    <ul>
      {todos.map(({ id, text }) => (
        <li key={id}>{text}</li>
      ))}
    </ul>
  );
}
```

For a more natural overview of queries with the `graphql()` function be sure to read the [Queries documentation article](queries.html). For a technical overview of all the features supported by the `graphql()` function for queries, continue on.

<h2 id="graphql-query-data">`props.data`</h2>

The higher-order component created when using `graphql()` will feed a `data` prop into your component. Like so:

```js
render() {
  const { data } = this.props; // <- The `data` prop.
}
```

The `data` prop contains the data fetched from your query in addition to some other useful information and functions to control the lifecycle of your GraphQL-connected component. So for example, if we had a query that looked like:

```graphql
{
  viewer { name }
  todos { text }
}
```

Your `data` prop would contain that data:

```js
render() {
  const { data } = this.props;

  console.log(data.viewer); // <- The data returned by your query for `viewer`.
  console.log(data.todos); // <- The data returned by your query for `todos`.
}
```

The `data` prop has some other useful properties which can be accessed directly from `data`. For example, `data.loading` or `data.error`. These properties are documented below.

Make sure to always check `data.loading` and `data.error` in your components before rendering. Properties like `data.todos` which contain your app’s data may be undefined while your component is performing its initial fetch. Checking `data.loading` and `data.error` helps you avoid any issues with undefined data. Such checks may look like:

```js
render() {
  const { data: { loading, error, todos } } = this.props;
  if (loading) {
    return <p>Loading...</p>;
  } else if (error) {
    return <p>Error!</p>;
  } else {
    return (
      <ul>
        {todos.map(({ id, text }) => (
          <li key={id}>{text}</li>
        ))}
      </ul>
    );
  }
}
```

<h3 id="graphql-query-data-loading">`data.loading`</h3>

A boolean representing whether or not a query request is currently in flight for this component. This means that a query request has been sent using your network interface, and we have not yet gotten a response back. Use this property to render a loading component.

However, just because `data.loading` is true it does not mean that you won’t have data. For instance, if you already have `data.todos`, but you want to get the latest todos from your API `data.loading` might be true, but you will still have the todos from your previous request.

There are multiple different network states that your query may be in. If you want to see what the network state of your component is in more detail then refer to [`data.networkStatus`](#graphql-query-data-networkStatus).

**Example:**

```js
function MyComponent({ data: { loading } }) {
  if (loading) {
    return <div>Loading...</div>;
  } else {
    // ...
  }
}

export default graphql(gql`query { ... }`)(MyComponent);
```

<h3 id="graphql-query-data-error">`data.error`</h3>

If an error occurred then this property will be an instance of [`ApolloError`][]. If you do not handle this error you will get a warning in your console that says something like: `"Unhandled (in react-apollo) Error: ..."`.

[`ApolloError`]: /core/apollo-client-api.html#ApolloError

**Example:**

```js
function MyComponent({ data: { error } }) {
  if (error) {
    return <div>Error!</div>;
  } else {
    // ...
  }
}

export default graphql(gql`query { ... }`)(MyComponent);
```

<h3 id="graphql-query-data-networkStatus">`data.networkStatus`</h3>

`data.networkStatus` is useful if you want to display a different loading indicator (or no indicator at all) depending on your network status as it provides a more detailed view into the state of a network request on your component than [`data.loading`](#graphql-query-data-loading) does. `data.networkStatus` is an enum with different number values between 1 and 8. These number values each represent a different network state.

1. `loading`: The query has never been run before and the request is now pending. A query will still have this network status even if a result was returned from the cache, but a query was dispatched anyway.
2. `setVariables`: If a query’s variables change and a network request was fired then the network status will be `setVariables` until the result of that query comes back. React users will see this when [`options.variables`](#graphql-query-options-variables) changes on their queries.
3. `fetchMore`: Indicates that `fetchMore` was called on this query and that the network request created is currently in flight.
4. `refetch`: It means that `refetch` was called on a query and the refetch request is currently in flight.
5. Unused.
6. `poll`: Indicates that a polling query is currently in flight. So for example if you are polling a query every 10 seconds then the network status will switch to `poll` every 10 seconds whenever a poll request has been sent but not resolved.
7. `ready`: No request is in flight for this query, and no errors happened. Everything is OK.
8. `error`: No request is in flight for this query, but one or more errors were detected.

If the network status is less then 7 then it is equivalent to [`data.loading`](#graphql-query-data-loading) being true. In fact you could replace all of your `data.loading` checks with `data.networkStatus < 7` and you would not see a difference. It is recommended that you use `data.loading`, however.

**Example:**

```js
function MyComponent({ data: { networkStatus } }) {
  if (networkStatus === 6) {
    return <div>Polling!</div>;
  } else if (networkStatus < 7) {
    return <div>Loading...</div>;
  } else {
    // ...
  }
}

export default graphql(gql`query { ... }`)(MyComponent);
```

<h3 id="graphql-query-data-variables">`data.variables`</h3>

The variables that Apollo used to fetch data from your GraphQL endpoint. This property is helpful if you want to render some information based on the variables that were used to make a request against your server.

**Example:**

```js
function MyComponent({ data: { variables } }) {
  return (
    <div>
      Query executed with the following variables:
      <code>{JSON.stringify(variables)}</code>
    </div>
  );
}

export default graphql(gql`query { ... }`)(MyComponent);
```

<h3 id="graphql-query-data-refetch">`data.refetch(variables)`</h3>

Forces your component to refetch the query you defined in the `graphql()` function. This method is helpful when you want to reload the data in your component, or retry a fetch after an error.

`data.refetch` returns a promise that resolves with the new data fetched from your API once the query has finished executing. The promise will reject if the query failed.

The `data.refetch` function takes a single `variables` object argument. The `variables` argument will replace `variables` used with either the `query` option or the query from your `graphql()` HOC (depending on whether or not you specified a `query`) option to refetch the query you defined in the `graphql()` function.

By default `data.refetch` or `data.fetchMore` merges the variables passed as an argument so if a variable is missed out in subsequent requests that variable will still pick the old value set before for that specific query. Old values of the nullable variables can be cleared by passing `null` or `undefined`.

**Example:**

```js
function MyComponent({ data: { refetch } }) {
  return (
    <button onClick={() => refetch()}>
      Reload
    </button>
  );
}

export default graphql(gql`query { ... }`)(MyComponent);
```

<h3 id="graphql-query-data-fetchMore">`data.fetchMore(options)`</h3>

The `data.fetchMore` function allows you to do pagination with your query component. To learn more about pagination with `data.fetchMore`, be sure to read the [pagination](pagination.html) recipe which contains helpful illustrations on how you can do pagination with React Apollo.

`data.fetchMore` returns a promise that resolves once the query executed to fetch more data has resolved.

The `data.fetchMore` function takes a single `options` object argument. The `options` argument may take the following properties:

- `[query]`: This is an optional GraphQL document created with the `gql` GraphQL tag. If you specify a `query` then that query will be fetched when you call `data.fetchMore`. If you do not specify a `query`, then the query from your `graphql()` HOC will be used.
- `[variables]`: The optional variables you may provide that will be used with either the `query` option or the query from your `graphql()` HOC (depending on whether or not you specified a `query`).
- `updateQuery(previousResult, { fetchMoreResult, queryVariables })`: This is the required function you define that will actually update your paginated list. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql()` function. The second argument is an object with two properties, `fetchMoreResult` and `queryVariables`. `fetchMoreResult` is the data returned by the new fetch that used the `query` and `variables` options from `data.fetchMore`. `queryVariables` are the variables that were used when fetching more data. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql()` function. See an example of this below, and also make sure to read the [pagination](pagination.html) recipe which has a full example.

**Example:**

```js
data.fetchMore({
  updateQuery: (previousResult, { fetchMoreResult, queryVariables }) => {
    return {
      ...previousResult,
      // Add the new feed data to the end of the old feed data.
      feed: [...previousResult.feed, ...fetchMoreResult.feed],
    };
  },
});
```

<h3 id="graphql-query-data-subscribeToMore">`data.subscribeToMore(options)`</h3>

This function will set up a subscription, triggering updates whenever the server sends a subscription publication. This requires subscriptions to be set up on the server to properly work. Check out the [subscriptions guide](http://dev.apollodata.com/react/receiving-updates.html#Subscriptions) and the [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) and [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) for more information on getting this set up.

This function returns an `unsubscribe` function handler which can be used to unsubscribe later.

A common practice is to wrap the `subscribeToMore` call within `componentWillReceiveProps` and perform the subscription after the original query has completed. To ensure the subscription isn't created multiple times, you can attach it to the component instance. See the example for more details.

- `[document]`: Document is a required property that accepts a GraphQL subscription created with `graphql-tag`’s `gql` template string tag. It should contain a single GraphQL subscription operation with the data that will be returned.
- `[variables]`: The optional variables you may provide that will be used with the `document` option.
- `[updateQuery]`: An optional function that runs every time the server sends an update. This modifies the results of the HOC query. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql()` function. The second argument is an object with two properties. `subscriptionData` is result of the subscription. `variables` is the variables object used with the subscription query. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql()` function. This is similar to the [`fetchMore`](#graphql-query-data-fetchMore) callback. Alternatively, you could update the query using a [reducer](http://dev.apollodata.com/react/cache-updates.html#resultReducers) as part of the [options](http://dev.apollodata.com/react/queries.html#graphql-options) of your `graphql()` function.
- `[onError]`: An optional error callback.

In order to update the query's store with the result of the subscription, you must specify either the `updateQuery` option in `subscribeToMore` or the `reducer` option in your `graphql()` function.

**Example:**

```js
class SubscriptionComponent extends Component {
  componentWillReceiveProps(nextProps) {
    if(!nextProps.data.loading) {
      // Check for existing subscription
      if (this.unsubscribe) {
        // Check if props have changed and, if necessary, stop the subscription
        if (this.props.subscriptionParam !== nextProps.subscriptionParam) {
          this.unsubscribe();
        } else {
          return;
        }
      }

      // Subscribe
      this.unsubscribe = nextProps.data.subscribeToMore({
        document: gql`subscription {...}`,
        updateQuery: (previousResult, { subscriptionData, variables }) => {
          // Perform updates on previousResult with subscriptionData
          return updatedResult;
        }
      });
    }
  }
  render() {
    ...
  }
}
```


<h3 id="graphql-query-data-startPolling">`data.startPolling(interval)`</h3>

This function will set up an interval and send a fetch request every time that interval ellapses. The function takes only one integer argument which allows you to configure how often you want your query to be executed in milliseconds. In other words, the `interval` argument represents the milliseconds between polls.

Polling is a good way to keep the data in your UI fresh. By refetching your data every 5,000 milliseconds (or 5 seconds, for example) you may effectively emulate realtime data without needing to build up a realtime backend.

If you call `data.startPolling` when your query is already polling then the current polling process will be cancelled and a new process will be started with the interval you specified.

You may also use [`options.pollInterval`](#graphql-config-options-pollInterval) to start polling immediately after your component mounts. It is recommend that you use [`options.pollInterval`](#graphql-config-options-pollInterval) if you don’t need to arbitrarily start and stop polling.

If you set your `interval` to 0 then that means no polling instead of executing a request every JavaScript event loop tick.

**Example:**

```js
class MyComponent extends Component {
  componentDidMount() {
    // In this specific case you may want to use `options.pollInterval` instead.
    this.props.data.startPolling(1000);
  }

  render() {
    // ...
  }
}

export default graphql(gql`query { ... }`)(MyComponent);
```

<h3 id="graphql-query-data-stopPolling">`data.stopPolling()`</h3>

By calling this function you will stop any current polling process. Your query will not start polling again until you call `data.startPolling`.

**Example:**

```js
class MyComponent extends Component {
  render() {
    return (
      <div>
        <button onClick={() => {
          this.props.data.startPolling(1000);
        }}>
          Start Polling
        </button>
        <button onClick={() => {
          this.props.data.stopPolling();
        }}>
          Stop Polling
        </button>
      </div>
    )
  }
}

export default graphql(gql`query { ... }`)(MyComponent);
```

<h3 id="graphql-query-data-updateQuery">`data.updateQuery(updaterFn)`</h3>

This function allows you to update the data for your query outside of the context of any mutation, subscription, or fetch. This function only takes a single argument which will be another function. The argument function has the following signature:

```
(previousResult, { variables }) => nextResult
```

The first argument will be the data for your query that currently exists in the store, and you are expected to return a new data object with the same shape. That new data object will be written to the store and any components tracking that data will be updated reactively.

The second argument is an object with a single property, `variables`. The `variables` property allows you to see what variables were used when reading the `previousResult` from the store.

This method will *not* update anything on the server. It will only update data in your client cache and if you reload your JavaScript environment then your update will disappear.

**Example:**

```js
data.updateQuery((previousResult) => ({
  ...previousResult,
  count: previousResult.count + 1,
}));
```

<h2 id="graphql-query-options">`config.options`</h2>

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use  in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are availble when your operation is a query. To see what other options are available for different operations, see the generic documentation for [`config.options`](api-graphql.html#graphql-config-options).

**Example:**

```js
export default graphql(gql`{ ... }`, {
  options: {
    // Options go here.
  },
})(MyComponent);
```

```js
export default graphql(gql`{ ... }`, {
  options: (props) => ({
    // Options are computed from `props` here.
  }),
})(MyComponent);
```

<h3 id="graphql-config-options-variables">`options.variables`</h3>

The variables that will be used when executing the query operation. These variables should correspond with the variables that your query definition accepts. If you define `config.options` as a function then you may compute your variables from your props.

**Example:**

```js
export default graphql(gql`
  query ($width: Int!, $height: Int!) {
    ...
  }
`, {
  options: (props) => ({
    variables: {
      width: props.size,
      height: props.size,
    },
  }),
})(MyComponent);
```

<h3 id="graphql-config-options-fetchPolicy">`options.fetchPolicy`</h3>

The fetch policy is an option which allows you to specify how you want your component to interact with the Apollo data cache. By default your component will try to read from the cache first, and if the full data for your query is in the cache then Apollo simply returns the data from the cache. If the full data for your query is *not* in the cache then Apollo will execute your request using your network interface. By changing this option you can change this behavior.

Valid `fetchPolicy` values are:

- `cache-first`: This is the default value where we always try reading data from your cache first. If all the data needed to fulfill your query is in the cache then that data will be returned. Apollo will only fetch from the network if a cached result is not available. This fetch policy aims to minimize the number of network requests sent when rendering your component.
- `cache-and-network`: This fetch policy will have Apollo first trying to read data from your cache. If all the data needed to fulfill your query is in the cache then that data will be returned. However, regardless of whether or not the full data is in your cache this `fetchPolicy` will *always* execute query with the network interface unlike `cache-first` which will only execute your query if the query data is not in your cache. This fetch policy optimizes for users getting a quick response while also trying to keep cached data consistent with your server data at the cost of extra network requests.
- `network-only`: This fetch policy will *never* return you initial data from the cache. Instead it will always make a request using your network interface to the server. This fetch policy optimizes for data consistency with the server, but at the cost of an instant response to the user when one is available.
- `cache-only`: This fetch policy will *never* execute a query using your network interface. Instead it will always try reading from the cache. If the data for your query does not exist in the cache then an error will be thrown. This fetch policy allows you to only interact with data in your local client cache without making any network requests which keeps your component fast, but means your local data might not be consistent with what is on the server. If you are interested in only interacting with data in your Apollo Client cache also be sure to look at the [`readQuery()`][] and [`readFragment()`][] methods available to you on your [`ApolloClient`][] instance.

[`readQuery()`]: ../core/apollo-client-api.html#ApolloClient.readQuery
[`readFragment()`]: ../core/apollo-client-api.html#ApolloClient.readFragment
[`ApolloClient`]: ../core/apollo-client-api.html#apollo-client

**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { fetchPolicy: 'cache-and-network' },
})(MyComponent);
```

<h3 id="graphql-config-options-pollInterval">`options.pollInterval`</h3>

The interval in milliseconds at which you want to start polling. Whenever that number of milliseconds elapses your query will be executed using the network interface and another execution will be scheduled using the configured number of milliseconds.

This option will start polling your query immediately when the component mounts. If you want to start and stop polling dynamically then you may use [`data.stopPolling`](#graphql-query-data-startPolling) and [`data.startPolling`](#graphql-query-data-stopPolling).

If you set `options.pollInterval` to 0 then that means no polling instead of executing a request every JavaScript event loop tick.

**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { pollInterval: 5000 },
})(MyComponent);
```

<h3 id="graphql-config-options-notifyOnNetworkStatusChange">`options.notifyOnNetworkStatusChange`</h3>

Whether or not updates to the network status or network error should trigger re-rendering of your component.

The default value is `false`.

**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { notifyOnNetworkStatusChange: true },
})(MyComponent);
```
