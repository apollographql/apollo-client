---
title: API Reference
---

This is a complete reference of every single feature available in React Apollo. If you are just getting started with React Apollo then you should read the documentation article on [Queries](queries.html) first and come back to this API reference when you need to look up what exactly an API does.

<h2 id="graphql">`graphql(query, [config])(component)`</h2>

The `graphql()` function is the most important thing exported by `react-apollo`. With this function you can create higher-order components that can execute queries and update reactively based on the data in your Apollo store. The `graphql()` function returns a function which will “enhance” any component with reactive GraphQL capabilities. This follows the React [higher-order component][] pattern which is also used by [`react-redux`’s `connect`][] function.

[higher-order component]: https://facebook.github.io/react/docs/higher-order-components.html
[`react-redux`’s `connect`]: https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options

The `graphql()` function may be used like this:

```js
function TodoApp({ data: { todos } }) {
  return (
    <ul>
      {todos.map(({ id, text }) => (
        <li key={id}>{text}</li>
      ))}
    </ul>
  );
}

export default graphql(gql`
  query TodoAppQuery {
    todos {
      id
      text
    }
  }
`)(TodoApp);
```

You may also define an intermediate function and hook up your component with the `graphql()` function like this:

```js
// Create our enhancer function.
const withTodoAppQuery = graphql(gql`query { ... }`);

// Enhance our component.
const TodoAppWithData = withTodoAppQuery(TodoApp);

// Export the enhanced component.
export default TodoAppWithData;
```

Alternatively, you can also use the `graphql()` function as a [decorator][] on your React class component.

[decorator]: https://github.com/wycats/javascript-decorators

If so your code may look like this:

```js
@graphql(gql`
  query TodoAppQuery {
    todos {
      id
      text
    }
  }
`)
export default class TodoApp extends Component {
  render() {
    const { data: { todos } } = this.props;
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

The `graphql()` function will only be able to provide access to your GraphQL data if there is a [`<ApolloProvider/>`](#ApolloProvider) component higher up in your tree to provide an [`ApolloClient`][] instance that will be used to fetch your data.

[`ApolloClient`]: ../core/apollo-client-api.html#apollo-client

The behavior of your component enhanced with the `graphql()` function will be different depending on if your GraphQL operation is a [query](#queries), a [mutation](#mutations), or a [subscription](#subscriptions). Go to the appropriate API documentation for more information about the functionality and available options for each type.

Before we look into the specific behaviors of each operation, let us look at the `config` object.

<h3 id="graphql-config">`config`</h3>

The `config` object is the second argument you pass into the `graphql()` function, after your GraphQL document. The config is optional and allows you to add some custom behavior to your higher order component.

```js
export default graphql(
  gql`{ ... }`,
  config, // <- The `config` object.
)(MyComponent);
```

Lets go through all of the properties that may live on your `config` object.

<h3 id="graphql-config.options">`config.options`</h3>

`config.options` is an object or a function that allows you to define the specific behavior your component should use in handling your GraphQL data.

The specific options available for configuration depend on the operation you pass as the first argument to `graphql()`. There are options specific to [queries](#graphql-query-options) and [mutations](#graphql-mutation-options).

You can define `config.options` as a plain object, or you can compute your options from a function that takes the component’s props as an argument.

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

<h3 id="graphql-config.props">`config.props`</h3>

The `config.props` property allows you to define a map function that takes your props including the props added by the `graphql()` function ([`props.data`](#graphql-query-data) for queries and [`props.mutate`](#graphql-mutation-mutate) for mutations) and allows you to compute a new props object that will be provided to the component that `graphql()` is wrapping.

The function you define behaves almost exactly like [`mapProps` from Recompose][] providing the same benefits without the need for another library.

[`mapProps` from Recompose]: https://github.com/acdlite/recompose/blob/2e71fdf4270cc8022a6574aaf00731bfc25dcae6/docs/API.md#mapprops

`config.props` is most useful when you want to abstract away complex functions calls into a simple prop that you can pass down to your component.

Another benefit of `config.props` is that it also allows you to decouple your pure UI components from your GraphQL and Apollo concerns. You can write your pure UI components in one file and then keep the logic required for them to interact with the store in a completely different place in your project. You can accomplish this by your pure UI components only asking for the props needed to render and `config.props` can contain the logic to provide exactly the props your pure component needs from the data provided by your GraphQL API.

**Example:**

This example uses [`props.data.fetchMore`](#graphql-query-data.fetchMore).

```js
export default graphql(gql`{ ... }`, {
  props: ({ data: { fetchMore } }) => ({
    onLoadMore: () => {
      fetchMore({ ... });
    },
  }),
})(MyComponent);

function MyComponent({ onLoadMore }) {
  return (
    <button onClick={onLoadMore}>
      Load More!
    </button>
  );
}
```

<h3 id="graphql-config.skip">`config.skip`</h3>

If `config.skip` is true then all of the React Apollo code will be skipped *entirely*. It will be as if the `graphql()` function were a simple identity function. Your component will behave as if the `graphql()` function were not there at all.

Instead of passing a boolean to `config.skip`, you may also pass a function to `config.skip`. The function will take your components props and should return a boolean. If the boolean returns true then the skip behavior will go into effect.

`config.skip` is especially useful if you want to use a different query based on some prop. You can see this in an example below.

**Example:**

```js
export default graphql(gql`{ ... }`, {
  skip: props => !!props.skip,
})(MyComponent);
```

The following example uses the [`compose()`](#compose) function to use multiple `graphql()` enhancers at once.

```js
export default compose(
  graphql(gql`query MyQuery1 { ... }`, { skip: props => !props.useQuery1 }),
  graphql(gql`query MyQuery2 { ... }`, { skip: props => props.useQuery1 }),
)(MyComponent);

function MyComponent({ data }) {
  // The data may be from `MyQuery1` or `MyQuery2` depending on the value
  // of the prop `useQuery1`.
  console.log(data);
}
```

<h3 id="graphql-config.name">`config.name`</h3>

This property allows you to configure the name of the prop that gets passed down to your component. By default if the GraphQL document you pass into `graphql()` is a query then your prop will be named [`data`](#graphql-query-data). If you pass a mutation then your prop will be named [`mutate`](#graphql-mutation-mutate). While appropriate these default names collide when you are trying to use multiple queries or mutations with the same component. To avoid collisions you may use `config.name` to provide the prop from each query or mutation HOC a new name.

**Example:**

This example uses the [`compose`](#compose) function to use multiple `graphql()` HOCs together.

```js
export default compose(
  graphql(gql`mutation (...) { ... }`, { name: 'createTodo' }),
  graphql(gql`mutation (...) { ... }`, { name: 'updateTodo' }),
  graphql(gql`mutation (...) { ... }`, { name: 'deleteTodo' }),
)(MyComponent);

function MyComponent(props) {
  // Instead of the default prop name, `mutate`,
  // we have three different prop names.
  console.log(props.createTodo);
  console.log(props.updateTodo);
  console.log(props.deleteTodo);

  return null;
}
```

<h3 id="graphql-config.withRef">`config.withRef`</h3>

By setting `config.withRef` to true you will be able to get the instance of your wrapped component from your higher-order GraphQL component using a `getWrappedInstance` method available on the instance of your higher-order GraphQL component.

You may want to set this to true when you want to call functions or get access to properties that are defined on your wrapped component’s class instance.

Below you can see an example of this behavior.

**Example:**

This example uses the [React `ref` feature][].

[React `ref` feature]: https://facebook.github.io/react/docs/refs-and-the-dom.html

```js
class MyComponent extends Component {
  saySomething() {
    console.log('Hello, world!');
  }

  render() {
    // ...
  }
}

const MyGraphQLComponent = graphql(
  gql`{ ... }`,
  { withRef: true },
)(MyComponent);

class MyContainerComponent extends Component {
  render() {
    return (
      <MyGraphQLComponent
        ref={component => {
          assert(component.getWrappedInstance() instanceof MyComponent);
          // We can call methods on the component class instance.
          component.saySomething();
        }}
      />
    );
  }
}
```

<h3 id="graphql-config.alias">`config.alias`</h3>

By default the display name for React Apollo components is `Apollo(${WrappedComponent.displayName})`. This is a pattern used by most React libraries that make use of higher order components. However, it may get a little confusing when you are using more then one higher order components and you look at the [React Devtools][].

[React Devtools]: https://camo.githubusercontent.com/42385f70ef638c48310ce01a675ceceb4d4b84a9/68747470733a2f2f64337676366c703535716a6171632e636c6f756466726f6e742e6e65742f6974656d732f30543361333532443366325330423049314e31662f53637265656e25323053686f74253230323031372d30312d3132253230617425323031362e33372e30302e706e673f582d436c6f75644170702d56697369746f722d49643d626536623231313261633434616130636135386432623562616265373336323626763d3236623964363434

To configure the name of your higher order component wrapper, you may use the `config.alias` property. So for example, if you set `config.alias` to `'withCurrentUser'` your wrapper component display name would be `withCurrentUser(${WrappedComponent.displayName})` instead of `Apollo(${WrappedComponent.displayName})`.

**Example:**

This example uses the [`compose`](#compose) function to use multiple `graphql()` HOCs together.

```js
export default compose(
  graphql(gql`{ ... }`, { alias: 'withCurrentUser' }),
  graphql(gql`{ ... }`, { alias: 'withList' }),
)(MyComponent);
```

<h3 id="queries">Queries</h3>

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

<h3 id="graphql-query-data">`props.data`</h3>

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

<h3 id="graphql-query-data.loading">`props.data.loading`</h3>

A boolean representing whether or not a query request is currently in flight for this component. This means that a query request has been sent using your network interface, and we have not yet gotten a response back. Use this property to render a loading component.

However, just because `data.loading` is true it does not mean that you won’t have data. For instance, if you already have `data.todos`, but you want to get the latest todos from your API `data.loading` might be true, but you will still have the todos from your previous request.

There are multiple different network states that your query may be in. If you want to see what the network state of your component is in more detail then refer to [`props.data.networkStatus`](#graphql-query-data.networkStatus).

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

<h3 id="graphql-query-data.error">`props.data.error`</h3>

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

<h3 id="graphql-query-data.networkStatus">`props.data.networkStatus`</h3>

`data.networkStatus` is useful if you want to display a different loading indicator (or no indicator at all) depending on your network status as it provides a more detailed view into the state of a network request on your component than [`data.loading`](#graphql-query-data.loading) does. `data.networkStatus` is an enum with different number values between 1 and 8. These number values each represent a different network state.

1. `loading`: The query has never been run before and the request is now pending. A query will still have this network status even if a result was returned from the cache, but a query was dispatched anyway.
2. `setVariables`: If a query’s variables change and a network request was fired then the network status will be `setVariables` until the result of that query comes back. React users will see this when [`options.variables`](#graphql-query-options-variables) changes on their queries.
3. `fetchMore`: Indicates that `fetchMore` was called on this query and that the network request created is currently in flight.
4. `refetch`: It means that `refetch` was called on a query and the refetch request is currently in flight.
5. Unused.
6. `poll`: Indicates that a polling query is currently in flight. So for example if you are polling a query every 10 seconds then the network status will switch to `poll` every 10 seconds whenever a poll request has been sent but not resolved.
7. `ready`: No request is in flight for this query, and no errors happened. Everything is OK.
8. `error`: No request is in flight for this query, but one or more errors were detected.

If the network status is less then 7 then it is equivalent to [`data.loading`](#graphql-query-data.loading) being true. In fact you could replace all of your `data.loading` checks with `data.networkStatus < 7` and you would not see a difference. It is recommended that you use `data.loading`, however.

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

<h3 id="graphql-query-data.variables">`props.data.variables`</h3>

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

<h3 id="graphql-query-data.refetch">`props.data.refetch()`</h3>

Forces your component to refetch the query you defined in the `graphql()` function. This method is helpful when you want to reload the data in your component, or retry a fetch after an error.

`data.refetch` returns a promise that resolves with the new data fetched from your API once the query has finished executing. The promise will reject if the query failed.

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

<h3 id="graphql-query-data.fetchMore">`props.data.fetchMore(options)`</h3>

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
    },
  },
});
```

<h3 id="graphql-query-data.subscribeToMore">`props.data.subscribeToMore(options)`</h3>

This function will set up a subscription, triggering updates whenever the server sends a subscription publication. This requires subscriptions to be set up on the server to properly work. Check out the [subscriptions guide](http://dev.apollodata.com/react/receiving-updates.html#Subscriptions) and the [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) and [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) for more information on getting this set up.

This function returns a `Subscription` object which can be used to unsubscribe later.

A common practice is to wrap the `subscribeToMore` call within `componentWillReceiveProps` and perform the subscription after the original query has completed. To ensure the subscription isn't created multiple times, you can attach it to the component instance. See the example for more details.

- `[document]`: Document is a required property that accepts a GraphQL subscription created with `graphql-tag`’s `gql` template string tag. It should contain a single GraphQL subscription operation with the data that will be returned.
- `[variables]`: The optional variables you may provide that will be used with the `document` option.
- `[updateQuery]`: An optional function that runs every time the server sends an update. This modifies the results of the HOC query. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql()` function. The second argument is an object with two properties. `subscriptionData` is result of the subscription. `variables` is the variables object used with the subscription query. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql()` function. This is similar to the [`fetchMore`](#graphql-query-data.fetchMore) callback. Alternatively, you could update the query using a [reducer](http://dev.apollodata.com/react/cache-updates.html#resultReducers) as part of the [options](http://dev.apollodata.com/react/queries.html#graphql-options) of your `graphql()` function.
- `[onError]`: An optional error callback.

In order to update the query's store with the result of the subscription, you must specify either the `updateQuery` option in `subscribeToMore` or the `reducer` option in your `graphql()` function.

**Example:**

```js
class SubscriptionComponent extends Component {
  constructor(props){
    super(props);
    this.subscription = null;
    ...
  }
  componentWillReceiveProps(nextProps) {
    // Check if props have changed and, if necessary, stop the subscription
    if (this.props.subscriptionParam !== nextProps.subscriptionParam) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    // Subscribe or re-subscribe
    if (!this.subscription && !nextProps.data.loading) {
      this.systemsSub = nextProps.data.subscribeToMore({
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


<h3 id="graphql-query-data.startPolling">`props.data.startPolling(interval)`</h3>

This function will set up an interval and send a fetch request every time that interval ellapses. The function takes only one integer argument which allows you to configure how often you want your query to be executed in milliseconds. In other words, the `interval` argument represents the milliseconds between polls.

Polling is a good way to keep the data in your UI fresh. By refetching your data every 5,000 milliseconds (or 5 seconds, for example) you may effectively emulate realtime data without needing to build up a realtime backend.

If you call `data.startPolling` when your query is already polling then the current polling process will be cancelled and a new process will be started with the interval you specified.

You may also use [`options.pollInterval`](#graphql-query-options.pollInterval) to start polling immediately after your component mounts. It is recommend that you use [`options.pollInterval`](#graphql-query-options.pollInterval) if you don’t need to arbitrarily start and stop polling.

If you set your `interval` to 0 then that means no polling instead of executing a request every JavaScript event loop tick.

**Example:**

```js
class MyComponent extends Component {
  componentDidMount() {
    // In this specific case you may want to use `options.pollInterval` isntead.
    this.props.data.startPolling(1000);
  }

  render() {
    // ...
  }
}

export default graphql(gql`query { ... }`)(MyComponent);
```

<h3 id="graphql-query-data.stopPolling">`props.data.stopPolling()`</h3>

By calling this function you will stop any current polling process. Your query will not start polling again until you call `props.data.startPolling`.

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

<h3 id="graphql-query-data.updateQuery">`props.data.updateQuery(updaterFn)`</h3>

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

<h3 id="graphql-query-options">`config.options`</h3>

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use  in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are availble when your operation is a query. To see what other options are available for different operations, see the generic documentation for [`config.options`](#graphql-config.options).

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

<h3 id="graphql-query-options.variables">`config.options.variables`</h3>

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

<h3 id="graphql-query-options.fetchPolicy">`config.options.fetchPolicy`</h3>

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

<h3 id="graphql-query-options.pollInterval">`config.options.pollInterval`</h3>

The interval in milliseconds at which you want to start polling. Whenever that number of milliseconds elapses your query will be executed using the network interface and another execution will be scheduled using the configured number of milliseconds.

This option will start polling your query immeadiately when the component mounts. If you want to start and stop polling dynamically then you may use [`props.data.stopPolling`](#graphql-query-data.startPolling) and [`props.data.startPolling`](#graphql-query-data.stopPolling).

If you set `options.pollInterval` to 0 then that means no polling instead of executing a request every JavaScript event loop tick.

**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { pollInterval: 5000 },
})(MyComponent);
```

<h3 id="mutations">Mutations</h3>

The operation that you pass into your `graphql()` function decides how your component will behave. If you pass a mutation into your `graphql()` function then Apollo will set up a `mutate` function in your components props that you may call at any time.

Here is an example component that uses a mutation with the `graphql()` function:

```js
export default graphql(gql`
  mutation TodoCompleteMutation($id: ID!) {
    completeTodo(id: $id) {
      id
      text
      completed
    }
  }
`)(TodoCompleteButton);

function TodoCompleteButton({ todoID, mutate }) {
  return (
    <button onClick={() => mutate({ variables: { id: todoID } })}>
      Complete
    </button>
  );
}
```

For a more natural overview of mutations with the `graphql()` function be sure to read the [Mutations documentation article](mutations.html). For a technical overview of all the features supported by the `graphql()` function for mutations, continue on.

<h3 id="graphql-mutation-mutate">`props.mutate`</h3>

The higher order component created when you pass a mutation to `graphql()` will provide your component with a single prop named `mutate`. Unlike the `data` prop which you get when you pass a query to `graphql()`, `mutate` is a function.

The `mutate` function will actually execute your mutation using the network interface therefore mutating your data. The `mutate` function will also then update your cache in ways you define.

To learn more about how mutations work, be sure to check out the [mutations usage documentation](mutations.html).

The `mutate` function accepts the same options that [`config.options` for mutations](#graphql-mutation-options) accepts, so to make sure to read through the documentation for that to know what you can pass into the `mutate` function.

The reason the `mutate` function accepts the same options is that it will use the options from [`config.options`](#graphql-mutation-options) _by default_. When you pass an object into the `mutate` function you are just overriding what is already in [`config.options`](#graphql-mutation-options).

**Example:**

```js
function MyComponent({ mutate }) {
  return (
    <button onClick={() => {
      mutate({
        variables: { foo: 42 },
      });
    }}>
      Mutate
    </button>
  );
}

export default graphql(gql`mutation { ... }`)(MyComponent);
```

<h3 id="graphql-mutation-options">`config.options`</h3>

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are availble when your operation is a query. To see what other options are available for different operations, see the generic documentation for [`config.options`](#graphql-config.options).

The properties accepted in this options object may also be excepted by the [`props.mutate`](#graphql-mutation-mutate) function. Any options passed into the `mutate` function will take precedence over the options defined in the `config` object.

**Example:**

```js
export default graphql(gql`mutation { ... }`, {
  options: {
    // Options go here.
  },
})(MyComponent);
```

```js
export default graphql(gql`mutation { ... }`, {
  options: (props) => ({
    // Options are computed from `props` here.
  }),
})(MyComponent);
```

```js
function MyComponent({ mutate }) {
  return (
    <button onClick={() => {
      mutate({
        // Options are component from `props` and component state here.
      });
    }}>
      Mutate
    </button>
  )
}

export default graphql(gql`mutation { ... }`)(MyComponent);
```

<h3 id="graphql-mutation-options.variables">`config.options.variables`</h3>

The variables which will be used to execute the mutation operation. These variables should correspond to the variables that your mutation definition accepts. If you define `config.options` as a function, or you pass variables into the [`props.mutate`](#graphql-mutation-mutate) function then you may compute your variables from props and component state.

**Example:**

```js
export default graphql(gql`
  mutation ($foo: String!, $bar: String!) {
    ...
  }
`, {
  options: (props) => ({
    variables: {
      foo: props.foo,
      bar: props.bar,
    },
  }),
})(MyComponent);
```

<h3 id="graphql-mutation-options.optimisticResponse">`config.options.optimisticResponse`</h3>

Often when you mutate data it is fairly easy to predict what the response of the mutation will be before asking your server. The optimistic response option allows you to make your mutations feel faster by simulating the result of your mutation in your UI before the mutation actually finishes.

To learn more about the benefits of optimistic data and how to use it be sure to read the recipe on [Optimistic UI](optimistic-ui.html).

This optimistic response will be used with [`options.update`](#graphql-mutation-options.update) and [`options.updateQueries`](#graphql-mutation-options.updateQueries) to apply an update to your cache which will be rolled back before applying the update from the actual response.

**Example:**

```js
function MyComponent({ newText, mutate }) {
  return (
    <button onClick={() => {
      mutate({
        variables: {
          text: newText,
        },
        // The optimistic response has all of the fields that are included in
        // the GraphQL mutation document below.
        optimisticResponse: {
          createTodo: {
            id: -1, // A temporary id. The server decides the real id.
            text: newText,
            completed: false,
          },
        },
      });
    }}>
      Add Todo
    </button>
  );
}

export default graphql(gql`
  mutation ($text: String!) {
    createTodo(text: $text) {
      id
      text
      completed
    }
  }
`)(MyComponent);
```

<h3 id="graphql-mutation-options.update">`config.options.update`</h3>

This option allows you to update your store based on your mutation’s result. By default Apollo Client will update all of the overlapping nodes in your store. Anything that shares the same id as returned by the `dataIdFromObject` you defined will be updated with the new fields from your mutation results. However, sometimes this alone is not sufficient. Sometimes you may want to update your cache in a way that is dependent on the data currently in your cache. For these updates you may use an `options.update` function.

`options.update` takes two arguments. The first is an instance of a [`DataProxy`][] object which has some methods which will allow you to interact with the data in your store. The second is the respone from your mutation. Either the optimistic response, or the actual response returned by your server.

In order to change the data in your store call methods on your [`DataProxy`][] instance like [`writeQuery`][] and [`writeFragment`][]. This will update your cache and reactively re-render any of your GraphQL components which are querying affected data.

To read the data from the store that you are changing, make sure to use methods on your [`DataProxy`][] like [`readQuery`][] and [`readFragment`][].

For more information on updating your cache after a mutation with the `options.update` function make sure to read the [Apollo Client technical documentation on the subject](../core/read-and-write.html#updating-the-cache-after-a-mutation).

[`DataProxy`]: ../core/apollo-client-api.html#DataProxy
[`writeQuery`]: ../core/apollo-client-api.html#DataProxy.writeQuery
[`writeFragment`]: ../core/apollo-client-api.html#DataProxy.writeFragment
[`readQuery`]: ../core/apollo-client-api.html#DataProxy.readQuery
[`readFragment`]: ../core/apollo-client-api.html#DataProxy.readFragment

**Example:**

```js
const query = gql`{ todos { ... } }`

export default graphql(gql`
  mutation ($text: String!) {
    createTodo(text: $text) { ... }
  }
`, {
  options: {
    update: (proxy, { data: { createTodo } }) => {
      const data = proxy.readQuery({ query });
      data.todos.push(createTodo);
      proxy.writeQuery({ query, data });
    },
  },
})(MyComponent);
```

<h3 id="graphql-mutation-options.refetchQueries">`config.options.refetchQueries`</h3>

Sometimes when you make a mutation you also want to update the data in your queries so that your users may see an up-to-date user interface. There are more fine-grained ways to update the data in your cache which include [`options.updateQueries`](#graphql-mutation-options.updateQueries), and [`options.update`](#graphql-mutation-options.update). However, you can update the data in your cache more reliably at the cost of efficiency by using `options.refetchQueries`.

`options.refetchQueries` will execute one or more queries using your network interface and will then normalize the results of those queries into your cache. Allowing you to potentially refetch queries you had fetched before, or fetch brand new queries.

`options.refetchQueries` is an array of either strings or objects.

If `options.refetchQueries` is an array of strings then Apollo Client will look for any queries with the same names as the provided strings and will refetch those queries with their current variables. So for example if you have a GraphQL query component with a query named `Comments` (the query may look like: `query Comments { ... }`), and you pass an array of strings containing `Comments` to `options.refetchQueries` then the `Comments` query will be re-executed and when it resolves the latest data will be reflected in your UI.

If `options.refetchQueries` is an array of objects then the objects must have two properties:

- `query`: Query is a required property that accepts a GraphQL query created with `graphql-tag`’s `gql` template string tag. It should contain a single GraphQL query operation that will be executed once the mutation has completed.
- `[variables]`: Is an optional object of variables that is required when `query` accepts some variables.

If an array of objects with this shape is specified then Apollo Client will refetch these queries with their variables.

**Example:**

```js
export default graphql(gql`mutation { ... }`, {
  options: {
    refetchQueries: [
      'CommentList',
      'PostList',
    ],
  },
})(MyComponent);
```

```js
import { COMMENT_LIST_QUERY } from '../components/CommentList';

export default graphql(gql`mutation { ... }`, {
  options: (props) => ({
    refetchQueries: [
      {
        query: COMMENT_LIST_QUERY,
      },
      {
        query: gql`
          query ($id: ID!) {
            post(id: $id) {
              commentCount
            }
          }
        `,
        variables: {
          id: props.postID,
        },
      },
    ],
  }),
})(MyComponent);
```

<h3 id="graphql-mutation-options.updateQueries">`config.options.updateQueries`</h3>

This option allows you to update your store based on your mutation’s result. By default Apollo Client will update all of the overlapping nodes in your store. Anything that shares the same id as returned by the `dataIdFromObject` you defined will be updated with the new fields from your mutation results. However, sometimes this alone is not sufficient. Sometimes you may want to update your cache in a way that is dependent on the data currently in your cache. For these updates you may use an `options.updateQueries` function.

`options.updateQueries` takes an object where query names are the keys and reducer functions are the values. If you are familiar with Redux, defining your `options.updateQueries` reducers is very similar to defining your Redux reducers. The object looks something like this:

```js
{
  Comments: (previousData, { mutationResult, queryVariables }) => nextData,
}
```

Make sure that the key of your `options.updateQueries` object corresponds to an actual query that you have made somewhere else in your app. The query name will be the name you put after specifying the `query` operation type. So for example in the following query:

```graphql
query Comments {
  entry(id: 5) {
    comments {
      ...
    }
  }
}
```

The query name would be `Comments`. If you have not executed a GraphQL query with the name of `Comments` before somewhere in your application, then the reducer function will never be run by Apollo and the key/value pair in `options.updateQueries` will be ignored.

The first argument to the function you provide as the value for your object will be the previous data for your query. So if your key is `Comments` then the first argument will be the last data object that was returned for your `Comments` query, or the current object that is being rendered by any component using the `Comments` query.

The second argument to your function value will be an object with three properties:

- `mutationResult`: The `mutationResult` property will represent the result of your mutation after hitting the server. If you provided an [`options.optimisticResponse`](#graphql-mutation-options.optimisticResponse) then `mutationResult` may be that object.
- `queryVariables`: The last set of variables that the query was executed with. This is helpful because when you specify the query name it will only update the data in the store for your current variable set.
- `queryName`: This is the name of the query you are updating. It is the same name as the key you provided to `options.updateQueries`.

The return value of your `options.updateQueries` functions _must_ have the same shape as your first `previousData` argument. However, you _must not_ mutate the `previousData` object. Instead you must create a new object with your changes. Just like in a Redux reducer.

To learn more about `options.updateQueries` read our usage documentation on [controlling the store with `updateQueries`](cache-updates.html#updateQueries).

**Example:**

```js
export default graphql(gql`
  mutation ($text: String!) {
    submitComment(text: $text) { ... }
  }
`, {
  options: {
    updateQueries: {
      Comments: (previousData, { mutationResult }) => {
        const newComment = mutationResult.data.submitComment;
        // Note how we return a new copy of `previousData` instead of mutating
        // it. This is just like a Redux reducer!
        return {
          ...previousData,
          entry: {
            ...previousData.entry,
            comments: [newComment, ...previousData.entry.comments],
          },
        };
      },
    },
  },
})(MyComponent);
```

<h3 id="subscription">Subscriptions</h3>

TODO

<h2 id="gql">``gql`{ ... }` ``</h2>

The `gql` template tag is what you use to define GraphQL queries in your Apollo Client apps. It parses your GraphQL query into the [GraphQL.js AST format][] which may then be consumed by Apollo Client methods. Whenever Apollo Client is asking for a GraphQL query you will always want to wrap it in a `gql` template tag.

You may embed a GraphQL document containing only fragments inside of another GraphQL document using template string interpolation. This allows you to use fragments defined in one part of your codebase inside of a query define in a completely different file. See the example below for a demonstration of how this works.

For convenience the `gql` tag is re-exported in `react-apollo` from the [`graphql-tag`][] package.

[GraphQL.js AST format]: https://github.com/graphql/graphql-js/blob/d92dd9883b76e54babf2b0ffccdab838f04fc46c/src/language/ast.js
[`graphql-tag`]: https://www.npmjs.com/package/graphql-tag

**Example:**

Notice how in the `query` variable we not only include the `fragments` variable through template string interpolation (`${fragments}`), but we also include a spread for the `foo` fragment in our query.

```js
const fragments = gql`
  fragment foo on Foo {
    a
    b
    c
    ...bar
  }

  fragment bar on Bar {
    d
    e
    f
  }
`;

const query = gql`
  query {
    ...foo
  }

  ${fragments}
`;
```

<h2 id="ApolloProvider">`<ApolloProvider client={client} />`</h2>

Makes the GraphQL client available to any of your components enhanced by the `graphql()` fucntion. The `<ApolloProvider/>` component works the same as the [`react-redux` `<Provider/>` component][]. It provides an [`ApolloClient`][] instance to all of your GraphQL components that either use the [`graphql()`](#graphql) function, or the [`withApollo`](#withApollo) function. You may also provide your Redux store using the `<ApolloProvider/>` component in addition to providing your GraphQL client.

If you do not add this component to the root of your React tree then your components enhanced with Apollo capabilities will not be able to function.

To learn more about initializing an instance of [`ApolloClient`][], be sure to read the [setup and options guide](initialization.html).

The `<ApolloProvider/>` component takes the following props:

- `client`: The required [`ApolloClient`][] instance. This [`ApolloClient`][] instance will be used by all of your components enhanced with GraphQL capabilties.
- `[store]`: This is an optional instance of a Redux store. If you choose to pass in your Redux store here then `<ApolloProvider/>` will also provide your Redux store like the [`react-redux` `<Provider/>` component][]. This means you only need to use one provider component instead of two!

If you want to get direct access to your [`ApolloClient`][] instance that is provided by `<ApolloProvider/>` in your components then be sure to look at the [`withApollo()`](#withApollo) enhancer function.

[`react-redux` `<Provider/>` component]: https://github.com/reactjs/react-redux/blob/master/docs/api.md#provider-store
[`ApolloClient`]: ../core/apollo-client-api.html#apollo-client

**Example:**

```js
ReactDOM.render(
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  document.getElementById('root'),
);
```

<h2 id="withApollo">`withApollo(component)`</h2>

A simple enhancer which provides direct access to your [`ApolloClient`][] instance. This is useful if you want to do custom logic with Apollo. Such as calling one-off queries. By calling this function with the component you want to enhance, `withApollo()` will create a new component which passes in an instance of [`ApolloClient`][] as a `client` prop.

If you are wondering when to use `withApollo()` and when to use [`graphql()`](#graphql) the answer is that most of the time you will want to use [`graphql()`](#graphql). [`graphql()`](#graphql) provides many of the advanced features you need to work with your GraphQL data. You should only use `withApollo()` if you want the GraphQL client without any of the other features.

This will only be able to provide access to your client if there is an [`<ApolloProvider/>`](#ApolloProvider) component higher up in your tree to actually provide the client.

[`ApolloClient`]: ../core/apollo-client-api.html#apollo-client

**Example:**

```js
export default withApollo(MyComponent);

function MyComponent({ client }) {
  console.log(client);
}
```

<h2 id="ApolloClient">`ApolloClient`</h2>

An `ApolloClient` instance is the core of the API for Apollo. It contains all of the methods you would need to interact with your GraphQL data, and it is the class you will use no matter which integration you are using.

To learn how to create your own instance of `ApolloClient` see the [initialization documentation article](initialization.html). You will then pass this instance into a root [`<ApolloProvider/>` component](#ApolloProvider).

For convenience `ApolloClient` is exported by `react-apollo` from the core Apollo Client package.

[To see the full API documentation for the `ApolloClient` class go to the core  documentation site.](../core/apollo-client-api.html#apollo-client)

**Example:**

```js
const client = new ApolloClient({
  ...
});
```

<h2 id="createNetworkInterface">`createNetworkInterface(config)`</h2>

The `createNetworkInterface()` function creates a simple HTTP network interface using the provided configuration object which includes the URI Apollo will use to fetch GraphQL from.

For convenience `createNetworkInterface()` is exported by `react-apollo` from the core Apollo Client package.

[To learn more about `createNetworkInterface` and network interfaces in general go to the core documentation site.](../core/network.html)

**Example:**

```js
const networkInterface = createNetworkInterface({
  uri: '/graphql',
});
```

<h2 id="compose">`compose(...enhancers)(component)`</h2>

For utility purposes, `react-apollo` exports a `compose` function. Using this function you may cleanly use several component enhancers at once. Including multiple [`graphql()`](#graphql), [`withApollo()`](#withApollo), or [Redux `connect()`][] enhancers. This should clean up your code when you use multiple enhancers. [Redux][] also exports a `compose` function, and so does [Recompose][] so you may choose to use the function from whichever library feels most appropriate.

An important note is that `compose()` executes the last enhancer _first_ and works its way backwards through the list of enhancers. To illustrate calling three functions like this: `funcC(funcB(funcA(component)))` is equivalent to calling `compose()` like this: `compose(funcC, funcB, funcA)(component)`. If this does not make sense to you consider using [`flowRight()` from Lodash][] which otherwise has the same behavior.

[Redux `connect()`]: https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options
[Redux]: http://redux.js.org/
[Recompose]: https://github.com/acdlite/recompose
[`flowRight()` from Lodash]: https://lodash.com/docs/4.17.4#flowRight

**Example:**

```js
export default compose(
  withApollo,
  graphql(`query { ... }`),
  graphql(`mutation { ... }`),
  connect(...),
)(MyComponent);
```

<h2 id="server">Server</h2>

`react-apollo` also provides some utilities to aid in server side rendering. To learn how to server side render in your app be sure to read the [recipe for server side rendering](server-side-rendering.html). The following is simply a reference for the APIs of the methods used in server side rendering and not a tutorial teaching you how to set it up.

<h2 id="getDataFromTree">`getDataFromTree(jsx)`</h2>

This function will walk through your React tree to find any components enhanced with `graphql()`. It will take those components which are queries, execute the queries, and return a promise to notify you when all of the queries have been resolved. This promise resolves to no value. You will not be able to see the data returned by the queries that were found.

After executing `getDataFromTree` when you render with the [`react-dom/server` methods][] like `renderToString` or `renderToStaticMarkup` the Apollo cache will be primed and your components will render with the fetched data in your cache. You may also choose to use the `react-apollo` [`renderToStringWithData()`](#renderToStringWithData) method which will call this function and then follow that with a call to [`react-dom/server`’s `renderToString`][].

If one of the queries fails the promise won’t reject until all of the queries have either resolved or rejected. At that point we will reject the promise returned from `getDataFromTree` with an error that has the property `error.queryErrors` which is an array of all the errors from the queries we executed. At that point you may decide to either render your tree anyway (if so, errored components will be in a loading state), or render an error page and do a full re-render on the client.

For more information see the [recipe for server side rendering](#server-side-rendering.html).

[`react-dom/server` methods]: https://facebook.github.io/react/docs/react-dom-server.html
[`react-dom/server`’s `renderToString`]: https://facebook.github.io/react/docs/react-dom-server.html#rendertostring

**Example:**

```js
const jsx = (
  <ApolloProvider client={client}>
    <MyRootComponent/>
  </ApolloProvider>
);

getDataFromTree(jsx)
  .then(() => {
    console.log(renderToString(jsx));
  })
  .catch((error) => {
    console.error(error);
  });
```

<h2 id="renderToStringWithData">`renderToStringWithData(jsx)`</h2>

This function calls [`getDataFromTree()`](#getDataFromTree) and when the promise returned by that function resolves it calls [`react-dom/server`’s `renderToString`][].

For more information see the documentation for [`getDataFromTree()`](#getDataFromTree) or the [recipe for server side rendering](#server-side-rendering.html).

[`react-dom/server`’s `renderToString`]: https://facebook.github.io/react/docs/react-dom-server.html#rendertostring

**Example:**

```js
renderToStringWithData(
  <ApolloProvider client={client}>
    <MyRootComponent/>
  </ApolloProvider>
)
  .then((html) => {
    console.log(html);
  })
  .catch((error) => {
    console.error(error);
  });
```
