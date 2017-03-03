---
title: API Documentation
---

<h2 id="graphql">`graphql(query, config)(component)`</h2>

The `graphql` function is the most important thing exported by `react-apollo`. With this function you can create higher-order components that can execute queries and update reactively based on the data in your Apollo store. The `graphql` function returns a function which will “enhance” any component with reactive GraphQL capabilities. This follows the React [higher-order component][] pattern which is also used by [`react-redux`’s `connect`][] function.

[higher-order component]: https://facebook.github.io/react/docs/higher-order-components.html
[`react-redux`’s `connect`]: https://github.com/reactjs/react-redux/blob/master/docs/api.md#connectmapstatetoprops-mapdispatchtoprops-mergeprops-options

The `graphql` function may be used like this:

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

Alternatively, you can also use the `graphql` function as a [decorator][] on your React class component.

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

The behavior of your component enhanced with the `graphql` function will be different depending on if your GraphQL operation is a [query](#queries), [mutation](#mutations), or a [subscription](#subscriptions). Go to the appropriate API documentation for more information about the functionality and available options for each type.

Before we look into the specific behaviors of each operation, let us look at the `config` object.

<h3 id="graphql-config">`config`</h3>

The `config` object is the second argument you pass into the `graphql` function. After your GraphQL document. The config is optional and allows you to add some custom behavior to your higher order component.

```js
export default graphql(
  gql`{ ... }`,
  config, // <- The `config` object.
)(MyComponent);
```

Lets go through all of the properties that may live on your `config` object.

<h3 id="graphql-config.options">`config.options`</h3>

`config.options` is an object or a function that allows you to define the specific behavior your component should use when talking with the network.

The specific options available for configuration depend on the operation you pass as the first argument to `graphql`. There are options specific to [queries](#graphql-query-options) and [mutations](#graphql-mutation-options).

You can define `config.options` as a plain object, or you can compute your options from a function that takes the component’s props as an argument.

**Example:**

```js
export default graphql(gql`{ ... }`, {
  options: {
    // Options go here.
  },
})(MyComponent);

export default graphql(gql`{ ... }`, {
  options: (props) => ({
    // Options are computed from `props` here.
  }),
})(MyComponent);
```

<h3 id="graphql-config.props">`config.props`</h3>

The `config.props` property allows you to define a map function that takes your props including the props added by the `graphql` function ([`props.data`](#graphql-query-data) for queries and [`props.mutate`](#graphql-mutation-mutate) for mutations) and allows you to compute a new props object that will be provided to the component that `graphql` is wrapping.

The function you define behaves almost exactly like [`mapProps` from Recompose][] providing the same benefits without the need of another library.

[`mapProps` from Recompose]: https://github.com/acdlite/recompose/blob/2e71fdf4270cc8022a6574aaf00731bfc25dcae6/docs/API.md#mapprops

`config.props` is most useful when you want to abstract away complex functions calls into a simple prop that you can pass down to your component.

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

If `config.skip` is true then all of the React Apollo code will be skipped *entirely*. It will be as if the `graphql` function were a simple identity function. Your component will behave as if the `graphql` function were not there at all.

Instead of passing a boolean to `config.skip`, you may also pass a function to `config.skip`. The function will take your components props and should return a boolean. If the boolean returns true then the skip behavior will go into effect.

**Example:**

```js
export default graphql(gql`{ ... }`, {
  skip: true,
})(MyComponent);
```

```js
export default graphql(gql`{ ... }`, {
  skip: props => !!props.skip,
})(MyComponent);
```

<h3 id="graphql-config.name">`config.name`</h3>

This property allows you to configure the name of the prop that gets passed down to your component. By default if the GraphQL document you pass into `graphql` is a query then your prop will be named [`data`](#graphql-query-data). If the you pass a mutation then your prop will be named [`mutate`](#graphql-mutation-mutate). While appropriate these default names collide when you are trying to use multiple queries or mutations with the same component. To avoid collisions you may use `config.name` to provide the prop from each query or mutation HOC a new name.

**Example:**

This example uses the [`compose`](#compose) function to use multiple `graphql` HOCs together.

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

Below you can see an example of this behavior.

**Example:**

```js
class MyWrappedComponent extends Component { ... }

const MyComponent = graphql(
  gql`{ ... }`,
  { withRef: true },
)(MyWrappedComponent);

class MyContainerComponent extends Component {
  render() {
    return (
      <MyWrappedComponent
        ref={component => {
          assert(component.getWrappedInstance() instanceof MyWrappedComponent);
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

This example uses the [`compose`](#compose) function to use multiple `graphql` HOCs together.

```js
export default compose(
  graphql(gql`{ ... }`, { alias: 'withCurrentUser' }),
  graphql(gql`{ ... }`, { alias: 'withList' }),
)(MyComponent);
```

<h3 id="queries">Queries</h3>

The operation that you pass into your `graphql` function decides how your component will behave. If you pass a query into your `graphql` function then your component will fetch that query and reactively listen to updates for the query in the store.

An example component using a query with the `graphql` function:

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

<h3 id="graphql-query-data">`props.data`</h3>

The higher-order component created when using `graphql` will feed a `data` prop into your component. Like so:

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

<h3 id="graphql-query-data.error">`props.data.error`</h3>

If an error occurred then this property will be an instance of [`ApolloError`][]. If you do not handle this error you will get a warning in your console that says something like: `"Unhandled (in react-apollo) Error: ..."`.

[`ApolloError`]: /core/apollo-client-api.html#ApolloError

<h3 id="graphql-query-data.variables">`props.data.variables`</h3>

The variables that Apollo used to fetch data from your GraphQL endpoint. This property is helpful if you want to render some information based on the variables that were used to make a request against your server.

<h3 id="graphql-query-data.refetch">`props.data.refetch()`</h3>

Forces your component to re-execute the query you defined in the `graphql` function. This method is helpful when you want to reload the data in your component, or retry a fetch after an error.

`data.refetch` returns a promise that resolves with the new data fetched from your API once the query has finished executing. The promise will reject if the query failed.

<h3 id="graphql-query-data.fetchMore">`props.data.fetchMore(options)`</h3>

The `data.fetchMore` function allows you to do pagination with your query component. To learn more about pagination with `data.fetchMore`, be sure to read the [pagination](pagination.html) recipe which contains helpful illustrations on how you can do pagination with React Apollo.

`data.fetchMore` returns a promise that resolves once the query executed to fetch more data has resolved.

The `data.fetchMore` function takes a single `options` object argument. The `options` argument may take the following properties:

- `[query]`: This is an optional GraphQL document created with the `gql` GraphQL tag. If you specify a `query` then that query will be fetched when you call `data.fetchMore`. If you do not specify a `query`, then the query from your `graphql` HOC will be used.
- `[variables]`: The optional variables you may provide that will be used with either the `query` option or the query from your `graphql` HOC (depending on whether or not you specified a `query`).
- `updateQuery(previousResult, { fetchMoreResult, queryVariables })`: This is the required function you define that will actually update your paginated list. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql` function. The second argument is an object with two properties, `fetchMoreResult` and `queryVariables`. `fetchMoreResult` is the data returned by the new fetch that used the `query` and `variables` options from `data.fetchMore`. `queryVariables` are the variables that were used when fetching more data. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql` function. See an example of this below, and also make sure to read the [pagination](pagination.html) recipe which has a full example.

**Example:**

```js
data.fetchMore({
  updateQuery: (previousResult, { fetchMoreResult }) => {
    return {
      ...previousResult,
      // Add the new feed data to the end of the old feed data.
      feed: [...previousResult.feed, ...fetchMoreResult.data.feed],
    },
  },
});
```

<h3 id="graphql-query-data.subscribeToMore">`props.data.subscribeToMore(options)`</h3>

TODO

<h3 id="graphql-query-data.startPolling">`props.data.startPolling(interval)`</h3>

This function will set up an interval and send a fetch request every time that interval executes. The function takes only one integer argument which allows you to configure how often you want your query to be executed in milliseconds.

Polling is a good way to keep the data in your UI fresh. By refetching your data every 5 seconds (for example) you may effectively emulate realtime data without needing to build up a realtime backend.

If you call `data.startPolling` when your query is already polling then the current polling process will be cancelled and a new process will be started with the interval you specified.

<h3 id="graphql-query-data.stopPolling">`props.data.stopPolling()`</h3>

By calling this function you will stop any current polling process. Your query will not start polling again until you call `props.data.startPolling`.

<h3 id="graphql-query-data.updateQuery">`props.data.updateQuery(updaterFn)`</h3>

This function allows you to update the data for your query outside of the context of any mutation, subscription, or fetch. This function only takes a single argument which will be another function. The argument function has the following signature:

```
(previousResult, { variables }) => nextResult
```

The first argument will be the data for your query that currently exists in the store, and you are expected to return a new data object with the same shape. That new data object will be written to the store and any components tracking that data will be updated reactively.

The second argument is an object with a single property, `variables`. The `variables` property allows you to see what variables were used when reading the `previousResult` from the store.

**Example:**

```js
data.updateQuery((previousResult) => ({
  ...previousResult,
  count: previousResult.count + 1,
}));
```

<h3 id="graphql-query-options">`config.options`</h3>

TODO

<h3 id="mutations">Mutations</h3>

<h3 id="graphql-mutation-options">`config.options`</h3>

TODO

<!-- TODO: ### Subscriptions? -->

<h2 id="ApolloProvider">`<ApolloProvider client={client} />`</h2>

<h2 id="withApollo">`withApollo(component)`</h2>

<h2 id="compose">`compose(TODO)`</h2>

<h2 id="server">Server</h2>

<h2 id="getDataFromTree">`getDataFromTree(TODO)`</h2>

<h2 id="renderToStringWithData">`renderToStringWithData(TODO)`</h2>
