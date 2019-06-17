---
title: React Apollo
description: React Apollo API reference
---

## `ApolloProvider`

React-Apollo includes a component for providing a client instance to a React component tree, and a higher-order component for retrieving that client instance.

```js
import { ApolloProvider } from 'react-apollo';
```

Makes the GraphQL client available to any of your components enhanced by the `graphql()` function. The `<ApolloProvider/>` component works the same as the `react-redux` `<Provider/>` component. It provides an [`ApolloClient`][] instance to all of your GraphQL components that either use the [`graphql()`][] function, or the [`withApollo()`][] function.

If you do not add this component to the root of your React tree then your components enhanced with Apollo capabilities will not be able to function.


The `<ApolloProvider/>` component takes the following props:

- `client`: The required [`ApolloClient`][] instance. This [`ApolloClient`][] instance will be used by all of your components enhanced with GraphQL capabilties.

If you want to get direct access to your [`ApolloClient`][] instance that is provided by `<ApolloProvider/>` in your components then be sure to look at the [`withApollo()`][] enhancer function.

**Example:**

```js
ReactDOM.render(
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  document.getElementById('root'),
);
```

## `ApolloConsumer`

To access the client directly, create an `ApolloConsumer` component and provide a render prop function as its child. The render prop function will be called with your `ApolloClient` instance as its only argument. You can think of the `ApolloConsumer` component as similar to the `Consumer` component from the [new React context API](https://github.com/reactjs/rfcs/blob/master/text/0002-new-version-of-context.md).

Here's the `ApolloConsumer` component in action:

```jsx
import React from 'react';
import { ApolloConsumer } from "react-apollo";

const WithApolloClient = () => (
  <ApolloConsumer>
    {client => "We have access to the client!" /* do stuff here */}
  </ApolloConsumer>
);
```

## `Query`

### Props

The Query component accepts the following props. Only `query` and `children` are **required**.

<dl>
  <dt>`query`: DocumentNode</dt>
  <dd>A GraphQL query document parsed into an AST by `graphql-tag`. **Required**</dd>
  <dt>`children`: (result: QueryResult) => React.ReactNode</dt>
  <dd>A function returning the UI you want to render based on your query result. **Required**</dd>
  <dt>`variables`: { [key: string]: any }</dt>
  <dd>An object containing all of the variables your query needs to execute</dd>
  <dt>`pollInterval`: number</dt>
  <dd>Specifies the interval in ms at which you want your component to poll for data. Defaults to 0 (no polling).</dd>
  <dt>`notifyOnNetworkStatusChange`: boolean</dt>
  <dd>Whether updates to the network status or network error should re-render your component. Defaults to false.</dd>
  <dt>`fetchPolicy`: FetchPolicy</dt>
  <dd>How you want your component to interact with the Apollo cache. Defaults to "cache-first".</dd>
  <dt>`errorPolicy`: ErrorPolicy</dt>
  <dd>How you want your component to handle network and GraphQL errors. Defaults to "none", which means we treat GraphQL errors as runtime errors.</dd>
  <dt>`ssr`: boolean</dt>
  <dd>Pass in false to skip your query during server-side rendering.</dd>
  <dt>`displayName`: string</dt>
  <dd>The name of your component to be displayed in React DevTools. Defaults to 'Query'.</dd>
  <dt>`skip`: boolean</dt>
  <dd>If skip is true, the query will be skipped entirely.</dd>
  <dt>`onCompleted`: (data: TData | {}) => void</dt>
  <dd>A callback executed once your query successfully completes.</dd>
  <dt>`onError`: (error: ApolloError) => void</dt>
  <dd>A callback executed in the event of an error.</dd>
  <dt>`context`: Record&lt;string, any&lt;</dt>
  <dd>Shared context between your Query component and your network interface (Apollo Link). Useful for setting headers from props or sending information to the `request` function of Apollo Boost.</dd>
  <dt>`partialRefetch`: boolean</dt>
  <dd>If `true`, perform a query `refetch` if the query result is marked as being partial, and the returned data is reset to an empty Object by the Apollo Client `QueryManager` (due to a cache miss). The default value is `false` for backwards-compatibility's sake, but should be changed to true for most use-cases.</dd>
  <dt>`client`: ApolloClient</dt>
  <dd>An `ApolloClient` instance. By default `Query` uses the client passed down via context, but a different client can be passed in.</dd>
  <dt>`returnPartialData`: boolean</dt>
  <dd>Opt into receiving partial results from the cache for queries that are not fully satisfied by the cache. `false` by default.</dd>
</dl>

### Render prop function

The render prop function that you pass to the `children` prop of `Query` is called with an object (`QueryResult`) that has the following properties. This object contains your query result, plus some helpful functions for refetching, dynamic polling, and pagination.

<dl>
  <dt>`data`: TData</dt>
  <dd>An object containing the result of your GraphQL query. Defaults to `undefined`.</dd>
  <dt>`loading`: boolean</dt>
  <dd>A boolean that indicates whether the request is in flight</dd>
  <dt>`error`: ApolloError</dt>
  <dd>A runtime error with `graphQLErrors` and `networkError` properties</dd>
  <dt>`variables`: { [key: string]: any }</dt>
  <dd>An object containing the variables the query was called with</dd>
  <dt>`networkStatus`: NetworkStatus</dt>
  <dd>A number from 1-8 corresponding to the detailed state of your network request. Includes information about refetching and polling status. Used in conjunction with the `notifyOnNetworkStatusChange` prop.</dd>
  <dt>`refetch`: (variables?: TVariables) => Promise&lt;ApolloQueryResult&gt;</dt>
  <dd>A function that allows you to refetch the query and optionally pass in new variables</dd>
  <dt>`fetchMore`: ({ query?: DocumentNode, variables?: TVariables, updateQuery: Function}) => Promise&lt;ApolloQueryResult&gt;</dt>
  <dd>A function that enables [pagination](/features/pagination/) for your query</dd>
  <dt>`startPolling`: (interval: number) => void</dt>
  <dd>This function sets up an interval in ms and fetches the query each time the specified interval passes.</dd>
  <dt>`stopPolling`: () => void</dt>
  <dd>This function stops the query from polling.</dd>
  <dt>`subscribeToMore`: (options: { document: DocumentNode, variables?: TVariables, updateQuery?: Function, onError?: Function}) => () => void</dt>
  <dd>A function that sets up a [subscription](/advanced/subscriptions/). `subscribeToMore` returns a function that you can use to unsubscribe.</dd>
  <dt>`updateQuery`: (previousResult: TData, options: { variables: TVariables }) => TData</dt>
  <dd>A function that allows you to update the query's result in the cache outside the context of a fetch, mutation, or subscription</dd>
  <dt>`client`: ApolloClient</dt>
  <dd>Your `ApolloClient` instance. Useful for manually firing queries or writing data to the cache.</dd>
</dl>

## `Mutation`

### Props

The Mutation component accepts the following props. Only `mutation` and `children` are **required**.

<dl>
  <dt>`mutation`: DocumentNode</dt>
  <dd>A GraphQL mutation document parsed into an AST by `graphql-tag`. **Required**</dd>
  <dt>`children`: (mutate: Function, result: MutationResult) => React.ReactNode</dt>
  <dd>A function that allows you to trigger a mutation from your UI. **Required**</dd>
  <dt>`variables`: { [key: string]: any }</dt>
  <dd>An object containing all of the variables your mutation needs to execute</dd>
  <dt>`update`: (cache: DataProxy, mutationResult: FetchResult)</dt>
  <dd>A function used to update the cache after a mutation occurs</dd>
  <dt>`ignoreResults`: boolean</dt>
  <dd>If true, the `data` property on the render prop function will not update with the mutation result.</dd>
  <dt>`optimisticResponse`: Object</dt>
  <dd>Provide a [mutation response](/features/optimistic-ui/) before the result comes back from the server</dd>
  <dt>`refetchQueries`: (mutationResult: FetchResult) => Array<{ query: DocumentNode, variables?: TVariables}></dt>
  <dd>A function that allows you to specify which queries you want to refetch after a mutation has occurred</dd>
  <dt>`onCompleted`: (data: TData) => void</dt>
  <dd>A callback executed once your mutation successfully completes</dd>
  <dt>`onError`: (error: ApolloError) => void</dt>
  <dd>A callback executed in the event of an error</dd>
  <dt>`context`: Record&lt;string, any&lt;</dt>
  <dd>Shared context between your Mutation component and your network interface (Apollo Link). Useful for setting headers from props or sending information to the `request` function of Apollo Boost.</dd>
  <dt>`client`: ApolloClient</dt>
  <dd>An `ApolloClient` instance. By default `Mutation` uses the client passed down via context, but a different client can be passed in.</dd>
</dl>

### Render prop function

The render prop function that you pass to the `children` prop of `Mutation` is called with the `mutate` function and an object with the mutation result. The `mutate` function is how you trigger the mutation from your UI. The object contains your mutation result, plus loading and error state.

**Mutate function:**

<dl>
  <dt>`mutate`: (options?: MutationOptions) => Promise&lt;FetchResult&gt;</dt>
  <dd>A function to trigger a mutation from your UI. You can optionally pass `variables`, `optimisticResponse`, `refetchQueries`, and `update` in as options, which will override any props passed to the `Mutation` component. The function returns a promise that fulfills with your mutation result.</dd>
</dl>

**Mutation result:**

<dl>
  <dt>`data`: TData</dt>
  <dd>The data returned from your mutation. It can be undefined if `ignoreResults` is true.</dd>
  <dt>`loading`: boolean</dt>
  <dd>A boolean indicating whether your mutation is in flight</dd>
  <dt>`error`: ApolloError</dt>
  <dd>Any errors returned from the mutation</dd>
  <dt>`called`: boolean</dt>
  <dd>A boolean indicating if the mutate function has been called</dd>
  <dt>`client`: ApolloClient</dt>
  <dd>Your `ApolloClient` instance. Useful for invoking cache methods outside the context of the update function, such as `client.writeData` and `client.readQuery`.</dd>
</dl>

## `Subscription`

### Props

The Subscription component accepts the following props. Only `subscription` and `children` are **required**.

<dl>
  <dt>`subscription`: DocumentNode</dt>
  <dd>A GraphQL subscription document parsed into an AST by `graphql-tag`. **Required**</dd>
  <dt>`children`: (result: SubscriptionResult) => React.ReactNode</dt>
  <dd>A function returning the UI you want to render based on your subscription result. **Required**</dd>
  <dt>`variables`: { [key: string]: any }</dt>
  <dd>An object containing all of the variables your subscription needs to execute</dd>
  <dt>`shouldResubscribe`: boolean</dt>
  <dd>Determines if your subscription should be unsubscribed and subscribed again</dd>
  <dt>`onSubscriptionData`: (options: OnSubscriptionDataOptions&lt;TData&gt;) => any</dt>
  <dd>Allows the registration of a callback function, that will be triggered each time the `Subscription` component receives data. The callback `options` object param consists of the current Apollo Client instance in `client`, and the received subscription data in `subscriptionData`.</dd>
  <dt>`fetchPolicy`: FetchPolicy</dt>
  <dd>How you want your component to interact with the Apollo cache. Defaults to "cache-first".</dd>
  <dt>`client`: ApolloClient</dt>
  <dd>An `ApolloClient` instance. By default `Subscription` uses the client passed down via context, but a different client can be passed in.</dd>
</dl>

### Render prop function

The render prop function that you pass to the `children` prop of `Subscription` is called with an object that has the following properties

<dl>
  <dt>`data`: TData</dt>
  <dd>An object containing the result of your GraphQL subscription. Defaults to an empty object.</dd>
  <dt>`loading`: boolean</dt>
  <dd>A boolean that indicates whether any initial data has been returned</dd>
  <dt>`error`: ApolloError</dt>
  <dd>A runtime error with `graphQLErrors` and `networkError` properties</dd>
</dl>

## `MockedProvider`

```js
import { MockedProvider } from "react-apollo/test-utils";
```

The Mocked provider is a test-utility that allows you to create a mocked version of the `ApolloProvider ` that doesn't send out network requests to your API but rather allows you to specify the exact response payload for a given request.

The `<MockedProvider />` component takes the following props:

- `addTypename`: A boolean indicating whether or not `__typename` are injected into the documents sent to graphql. This **defaults to true**.
- `defaultOptions`: An object containing options to pass directly to the `ApolloClient`instance. See documentation [here][].
- `cache`: A custom cache object to be used in your test. Defaults to `InMemoryCache`. Useful when you need to define a custom `dataIdFromObject` function for automatic cache updates.
- `mocks`: An array containing a request object and the corresponding response. You can define mocks in the following shape:.

```js
const mocks = [
  {
    request: {
      query: SOME_QUERY,
      variables: { first: 4 }
    },
    result: {
      data: {
        dog: {
          name: "Douglas"
        }
      }
    }
  },
  {
    request: {
      query: SOME_QUERY,
      variables: { first: 8}
    },
    error: new Error("Something went wrong")
  }
]
```

The example above shows that if the request `SOME_QUERY` is fired with variables `{ first: 4 }` that it results in the data in the `result` object.

If `SOME_QUERY` is fired with variables `{ first: 8 }` then it results in an `error`.

**Example:**

```js
it("runs the mocked query", () => {
  render(
    <MockedProvider mocks={mocks}>
      <MyQueryComponent />
    </MockedProvider>
  )

  // Run assertions on <MyQueryComponent/>
});
```

## `graphql(query, [config])(component)`

```js
import { graphql } from 'react-apollo';
```

The `graphql()` function is the most important thing exported by `react-apollo`. With this function you can create higher-order components that can execute queries and update reactively based on the data in your Apollo store. The `graphql()` function returns a function which will “enhance” any component with reactive GraphQL capabilities. This follows the React [higher-order component](https://facebook.github.io/react/docs/higher-order-components.html) pattern which is also used by [`react-redux`’s `connect`](https://github.com/reduxjs/react-redux/blob/master/docs/api/connect.md) function.

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

The `graphql()` function will only be able to provide access to your GraphQL data if there is a [`<ApolloProvider/>`][] component higher up in your tree to provide an [`ApolloClient`][] instance that will be used to fetch your data.

The behavior of your component enhanced with the `graphql()` function will be different depending on if your GraphQL operation is a [query](/essentials/queries/), a [mutation](/essentials/mutations/), or a [subscription](/advanced/subscriptions/). Go to the appropriate API documentation for more information about the functionality and available options for each type.

Before we look into the specific behaviors of each operation, let us look at the `config` object. The `config` object is the second argument you pass into the `graphql()` function, after your GraphQL document. The config is optional and allows you to add some custom behavior to your higher order component.

```js
export default graphql(
  gql`{ ... }`,
  config, // <- The `config` object.
)(MyComponent);
```

Lets go through all of the properties that may live on your `config` object.

### `config.options`

`config.options` is an object or a function that allows you to define the specific behavior your component should use in handling your GraphQL data.

The specific options available for configuration depend on the operation you pass as the first argument to `graphql()`. There are options specific to [queries](/essentials/queries/) and [mutations](/essentials/mutations/).

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

### `config.props`

The `config.props` property allows you to define a map function that takes the `props` (and optionally `lastProps`) added by the `graphql()` function ([`props.data`](#propsdata) for queries and [`props.mutate`][] for mutations) and allows you to compute a new `props` (and optionally `lastProps`) object that will be provided to the component that `graphql()` is wrapping.

The function you define behaves almost exactly like [`mapProps` from Recompose](https://github.com/acdlite/recompose/blob/2e71fdf4270cc8022a6574aaf00731bfc25dcae6/docs/API.md#mapprops) providing the same benefits without the need for another library.

`config.props` is most useful when you want to abstract away complex functions calls into a simple prop that you can pass down to your component.

Another benefit of `config.props` is that it also allows you to decouple your pure UI components from your GraphQL and Apollo concerns. You can write your pure UI components in one file and then keep the logic required for them to interact with the store in a completely different place in your project. You can accomplish this by your pure UI components only asking for the props needed to render and `config.props` can contain the logic to provide exactly the props your pure component needs from the data provided by your GraphQL API.

**Example:**

This example uses [`props.data.fetchMore`](#datafetchmoreoptions).

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

To access props that are not added by the `graphql()` function, use the `ownProps` keyword. For example:

```js
export default graphql(gql`{ ... }`, {
  props: ({ data: { liveImage }, ownProps: { loadingImage } }) => ({
    image: liveImage || loadingImage,
  }),
})(MyComponent);
```

To access `lastProps`, use the second argument of `config.props`. For example:

```js
export default graphql(gql`{ ... }`, {
  props: ({ data: { liveImage } }, lastProps) => ({
    image: liveImage,
    lastImage: lastProps.data.liveImage
  }),
})(MyComponent);
```

### `config.skip`

If `config.skip` is true then all of the React Apollo code will be skipped *entirely*. It will be as if the `graphql()` function were a simple identity function. Your component will behave as if the `graphql()` function were not there at all.

Instead of passing a boolean to `config.skip`, you may also pass a function to `config.skip`. The function will take your components props and should return a boolean. If the boolean returns true then the skip behavior will go into effect.

`config.skip` is especially useful if you want to use a different query based on some prop. You can see this in an example below.

**Example:**

```js
export default graphql(gql`{ ... }`, {
  skip: props => !!props.skip,
})(MyComponent);
```

The following example uses the [`compose`][] function to use multiple `graphql()` enhancers at once.

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

### `config.name`

This property allows you to configure the name of the prop that gets passed down to your component. By default if the GraphQL document you pass into `graphql()` is a query then your prop will be named [`data`](#propsdata). If you pass a mutation then your prop will be named [`mutate`](#propsmutate). While appropriate these default names collide when you are trying to use multiple queries or mutations with the same component. To avoid collisions you may use `config.name` to provide the prop from each query or mutation HOC a new name.

**Example:**

This example uses the [`compose`][] function to use multiple `graphql()` HOCs together.

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

### `config.withRef`

By setting `config.withRef` to true you will be able to get the instance of your wrapped component from your higher-order GraphQL component using a `getWrappedInstance` method available on the instance of your higher-order GraphQL component.

You may want to set this to true when you want to call functions or get access to properties that are defined on your wrapped component’s class instance.

Below you can see an example of this behavior.

**Example:**

This example uses the [React `ref` feature](https://facebook.github.io/react/docs/refs-and-the-dom.html).

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
          const wrappedInstance = component.getWrappedInstance();
          assert(wrappedInstance instanceof MyComponent);
          // We can call methods on the component class instance.
          wrappedInstance.saySomething();
        }}
      />
    );
  }
}
```

### `config.alias`

By default the display name for React Apollo components is `Apollo(${WrappedComponent.displayName})`. This is a pattern used by most React libraries that make use of higher order components. However, it may get a little confusing when you are using more than one higher order component and you look at the [React Devtools](https://camo.githubusercontent.com/42385f70ef638c48310ce01a675ceceb4d4b84a9/68747470733a2f2f64337676366c703535716a6171632e636c6f756466726f6e742e6e65742f6974656d732f30543361333532443366325330423049314e31662f53637265656e25323053686f74253230323031372d30312d3132253230617425323031362e33372e30302e706e673f582d436c6f75644170702d56697369746f722d49643d626536623231313261633434616130636135386432623562616265373336323626763d3236623964363434).

To configure the name of your higher order component wrapper, you may use the `config.alias` property. So for example, if you set `config.alias` to `'withCurrentUser'` your wrapper component display name would be `withCurrentUser(${WrappedComponent.displayName})` instead of `Apollo(${WrappedComponent.displayName})`.

**Example:**

This example uses the [`compose`][] function to use multiple `graphql()` HOCs together.

```js
export default compose(
  graphql(gql`{ ... }`, { alias: 'withCurrentUser' }),
  graphql(gql`{ ... }`, { alias: 'withList' }),
)(MyComponent);
```

## `graphql() options for queries`

### `props.data`

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
  }
  if (error) {
    return <p>Error!</p>;
  }
  return (
    <ul>
      {todos.map(({ id, text }) => (
        <li key={id}>{text}</li>
      ))}
    </ul>
  );
}
```

### `data.loading`

A boolean representing whether or not a query request is currently in flight for this component. This means that a query request has been sent using your network interface, and we have not yet gotten a response back. Use this property to render a loading component.

However, just because `data.loading` is true it does not mean that you won’t have data. For instance, if you already have `data.todos`, but you want to get the latest todos from your API `data.loading` might be true, but you will still have the todos from your previous request.

There are multiple different network states that your query may be in. If you want to see what the network state of your component is in more detail then refer to [`data.networkStatus`](#datanetworkstatus).

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

### `data.error`

If an error occurred then this property will be an instance of `ApolloError`. If you do not handle this error you will get a warning in your console that says something like: `"Unhandled (in react-apollo) Error: ..."`.

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

### `data.networkStatus`

`data.networkStatus` is useful if you want to display a different loading indicator (or no indicator at all) depending on your network status as it provides a more detailed view into the state of a network request on your component than [`data.loading`][] does. `data.networkStatus` is an enum with different number values between 1 and 8. These number values each represent a different network state.

1. `loading`: The query has never been run before and the request is now pending. A query will still have this network status even if a result was returned from the cache, but a query was dispatched anyway.
2. `setVariables`: If a query’s variables change and a network request was fired then the network status will be `setVariables` until the result of that query comes back. React users will see this when [`options.variables`](#optionsvariables) changes on their queries.
3. `fetchMore`: Indicates that `fetchMore` was called on this query and that the network request created is currently in flight.
4. `refetch`: It means that `refetch` was called on a query and the refetch request is currently in flight.
5. Unused.
6. `poll`: Indicates that a polling query is currently in flight. So for example if you are polling a query every 10 seconds then the network status will switch to `poll` every 10 seconds whenever a poll request has been sent but not resolved.
7. `ready`: No request is in flight for this query, and no errors happened. Everything is OK.
8. `error`: No request is in flight for this query, but one or more errors were detected.

If the network status is less then 7 then it is equivalent to [`data.loading`][] being true. In fact you could replace all of your `data.loading` checks with `data.networkStatus < 7` and you would not see a difference. It is recommended that you use `data.loading`, however.

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

### `data.variables`

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

### `data.refetch(variables)`

Forces your component to refetch the query you defined in the `graphql()` function. This method is helpful when you want to reload the data in your component, or retry a fetch after an error.

`data.refetch` returns a promise that resolves with the new data fetched from your API once the query has finished executing. The promise will reject if the query failed.

The `data.refetch` function takes a single `variables` object argument. The `variables` argument will replace `variables` used with either the `query` option or the query from your `graphql()` HOC (depending on whether or not you specified a `query`) option to refetch the query you defined in the `graphql()` function.

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

### `data.fetchMore(options)`

The `data.fetchMore` function allows you to do pagination with your query component. To learn more about pagination with `data.fetchMore`, be sure to read the [pagination](/features/pagination/) recipe which contains helpful illustrations on how you can do pagination with React Apollo.

`data.fetchMore` returns a promise that resolves once the query executed to fetch more data has resolved.

The `data.fetchMore` function takes a single `options` object argument. The `options` argument may take the following properties:

- `[query]`: This is an optional GraphQL document created with the `gql` GraphQL tag. If you specify a `query` then that query will be fetched when you call `data.fetchMore`. If you do not specify a `query`, then the query from your `graphql()` HOC will be used.
- `[variables]`: The optional variables you may provide that will be used with either the `query` option or the query from your `graphql()` HOC (depending on whether or not you specified a `query`).
- `updateQuery(previousResult, { fetchMoreResult, variables })`: This is the required function you define that will actually update your paginated list. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql()` function. The second argument is an object with two properties, `fetchMoreResult` and `variables`. `fetchMoreResult` is the data returned by the new fetch that used the `query` and `variables` options from `data.fetchMore`. `variables` are the variables that were used when fetching more data. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql()` function. See an example of this below, and also make sure to read the [pagination](/features/pagination/) recipe which has a full example.

**Example:**

```js
data.fetchMore({
  updateQuery: (previousResult, { fetchMoreResult, variables }) => {
    return {
      ...previousResult,
      // Add the new feed data to the end of the old feed data.
      feed: [...previousResult.feed, ...fetchMoreResult.feed],
    };
  },
});
```

### `data.subscribeToMore(options)`

This function will set up a subscription, triggering updates whenever the server sends a subscription publication. This requires subscriptions to be set up on the server to properly work. Check out the [subscriptions guide](/advanced/subscriptions/) and the [subscriptions-transport-ws](https://github.com/apollographql/subscriptions-transport-ws) and [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) for more information on getting this set up.

This function returns an `unsubscribe` function handler which can be used to unsubscribe later.

A common practice is to wrap the `subscribeToMore` call within `getDerivedStateFromProps` and perform the subscription after the original query has completed. To ensure the subscription isn't created multiple times, you can add it to component state. See the example for more details.

- `[document]`: Document is a required property that accepts a GraphQL subscription created with `graphql-tag`’s `gql` template string tag. It should contain a single GraphQL subscription operation with the data that will be returned.
- `[variables]`: The optional variables you may provide that will be used with the `document` option.
- `[updateQuery]`: An optional function that runs every time the server sends an update. This modifies the results of the HOC query. The first argument, `previousResult`, will be the previous data returned by the query you defined in your `graphql()` function. The second argument is an object with two properties. `subscriptionData` is result of the subscription. `variables` is the variables object used with the subscription query. Using these arguments you should return a new data object with the same shape as the GraphQL query you defined in your `graphql()` function. This is similar to the [`fetchMore`](#datafetchmoreoptions) callback.
- `[onError]`: An optional error callback.

In order to update the query's store with the result of the subscription, you must specify either the `updateQuery` option in `subscribeToMore` or the `reducer` option in your `graphql()` function.

**Example:**

```js
class SubscriptionComponent extends Component {
  state = {
    subscriptionParam: null,
    unsubscribe: null,
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    if (!nextProps.data.loading) {
      // Check for existing subscription
      if (prevState.unsubscribe) {
        // Only unsubscribe/update state if subscription variable has changed
        if (prevState.subscriptionParam === nextProps.subscriptionParam) {
          return null;
        }
        prevState.unsubscribe();
      }

      return {
        // Subscribe
        unsubscribe: nextProps.data.subscribeToMore({
          document: gql`subscription {...}`,
          variables: {
            param: nextProps.subscriptionParam,
          },
          updateQuery: (previousResult, { subscriptionData, variables }) => {
            // Perform updates on previousResult with subscriptionData
            return updatedResult;
          },
        }),
        // Store subscriptionParam in state for next update
        subscriptionParam: nextProps.subscriptionParam,
      };
    }

    return null;
  }

  render() {
    ...
  }
}
```

### `data.startPolling(interval)`

This function will set up an interval and send a fetch request every time that interval ellapses. The function takes only one integer argument which allows you to configure how often you want your query to be executed in milliseconds. In other words, the `interval` argument represents the milliseconds between polls.

Polling is a good way to keep the data in your UI fresh. By refetching your data every 5,000 milliseconds (or 5 seconds, for example) you may effectively emulate realtime data without needing to build up a realtime backend.

If you call `data.startPolling` when your query is already polling then the current polling process will be cancelled and a new process will be started with the interval you specified.

You may also use [`options.pollInterval`][] to start polling immediately after your component mounts. It is recommend that you use [`options.pollInterval`][] if you don’t need to arbitrarily start and stop polling.

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

### `data.stopPolling()`

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

### `data.updateQuery(updaterFn)`

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

### `config.options`

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use  in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are available when your operation is a query. To see what other options are available for different operations, see the generic documentation for [`config.options`][].

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

### `options.variables`

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

### `options.fetchPolicy`

The fetch policy is an option which allows you to specify how you want your component to interact with the Apollo data cache. By default your component will try to read from the cache first, and if the full data for your query is in the cache then Apollo simply returns the data from the cache. If the full data for your query is *not* in the cache then Apollo will execute your request using your network interface. By changing this option you can change this behavior.

Valid `fetchPolicy` values are:

- `cache-first`: This is the default value where we always try reading data from your cache first. If all the data needed to fulfill your query is in the cache then that data will be returned. Apollo will only fetch from the network if a cached result is not available. This fetch policy aims to minimize the number of network requests sent when rendering your component.
- `cache-and-network`: This fetch policy will have Apollo first trying to read data from your cache. If all the data needed to fulfill your query is in the cache then that data will be returned. However, regardless of whether or not the full data is in your cache this `fetchPolicy` will *always* execute query with the network interface unlike `cache-first` which will only execute your query if the query data is not in your cache. This fetch policy optimizes for users getting a quick response while also trying to keep cached data consistent with your server data at the cost of extra network requests.
- `network-only`: This fetch policy will *never* return you initial data from the cache. Instead it will always make a request using your network interface to the server. This fetch policy optimizes for data consistency with the server, but at the cost of an instant response to the user when one is available.
- `cache-only`: This fetch policy will *never* execute a query using your network interface. Instead it will always try reading from the cache. If the data for your query does not exist in the cache then an error will be thrown. This fetch policy allows you to only interact with data in your local client cache without making any network requests which keeps your component fast, but means your local data might not be consistent with what is on the server. If you are interested in only interacting with data in your Apollo Client cache also be sure to look at the [`readQuery()` and `readFragment()`](/advanced/caching/#readquery) methods available to you on your `ApolloClient` instance.
- `no-cache`: This fetch policy will *never* return your initial data from the cache. Instead it will always make a request using your network interface to the server. Unlike the `network-only` policy, it also will not write any data to the cache after the query completes.

**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { fetchPolicy: 'cache-and-network' },
})(MyComponent);
```

### `options.errorPolicy`

The error policy is an option which allows you to specify how you want your component to handle errors that can happen when fetching data from GraphQL. There are two types of errors that can happen during your request; a runtime error on the client or server which results in no data, or some GraphQL errors which may be delivered alongside actual data. In order to control how your UI interacts with these errors, you can use the error policy to tell Apollo when you want to know about GraphQL Errors or not!

Valid `errorPolicy` values are:

- `none`: This is the default value where we treat GraphQL errors as runtime errors. Apollo will discard any data that came back with the request and render your component with an `error` prop.
- `ignore`: Much like `none`, this causes Apollo to ignore any data from your server, but it also won't update your UI aside from setting the loading state back to false.
- `all`: Selecting all means you want to be notified any time there are any GraphQL errors. It will render your component with any data from the request and any errors with their information. It is particularly helpful for server side rendering so your UI always shows something


**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { errorPolicy: 'all' },
})(MyComponent);
```


### `options.pollInterval`

The interval in milliseconds at which you want to start polling. Whenever that number of milliseconds elapses your query will be executed using the network interface and another execution will be scheduled using the configured number of milliseconds.

This option will start polling your query immediately when the component mounts. If you want to start and stop polling dynamically then you may use [`data.startPolling`](#datastartpollinginterval) and [`data.stopPolling`](#datastoppolling).

If you set `options.pollInterval` to 0 then that means no polling instead of executing a request every JavaScript event loop tick.

**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { pollInterval: 5000 },
})(MyComponent);
```

### `options.notifyOnNetworkStatusChange`

Whether or not updates to the network status or network error should trigger re-rendering of your component.

The default value is `false`.

**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { notifyOnNetworkStatusChange: true },
})(MyComponent);
```

### `options.context`

With the flexiblity and power of [Apollo Link](https://www.apollographql.com/docs/link) being part of Apollo Client, you may want to send information from your operation straight to a link in your network chain! This can be used to do things like set `headers` on HTTP requests from props, control which endpoint you send a query to, and so much more depending on what links your app is using. Everything under the `context` object gets passed directly to your network chain. For more information about using context, check out the [docs on context with links](https://www.apollographql.com/docs/link/overview#context)

### `partialRefetch`

If `true`, perform a query `refetch` if the query result is marked as being partial, and the returned data is reset to an empty Object by the Apollo Client `QueryManager` (due to a cache miss).

The default value is `false` for backwards-compatibility's sake, but should be changed to true for most use-cases.

**Example:**

```js
export default graphql(gql`query { ... }`, {
  options: { partialRefetch: true },
})(MyComponent);
```

## `graphql() options for mutations`

### `props.mutate`

The higher order component created when you pass a mutation to `graphql()` will provide your component with a single prop named `mutate`. Unlike the `data` prop which you get when you pass a query to `graphql()`, `mutate` is a function.

The `mutate` function will actually execute your mutation using the network interface therefore mutating your data. The `mutate` function will also then update your cache in ways you define.

To learn more about how mutations work, be sure to check out the [mutations usage documentation](/essentials/mutations/).

The `mutate` function accepts the same options that [`config.options`](#configoptions-2) for mutations accepts, so make sure to read through the documentation for that to know what you can pass into the `mutate` function.

The reason the `mutate` function accepts the same options is that it will use the options from [`config.options`](#configoptions-2) _by default_. When you pass an object into the `mutate` function you are just overriding what is already in [`config.options`](#configoptions-2).

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

### `config.options`

An object or function that returns an object of options that are used to configure how the query is fetched and updated.

If `config.options` is a function then it will take the component’s props as its first argument.

The options available for use in this object depend on the operation type you pass in as the first argument to `graphql()`. The references below will document which options are available when your operation is a mutation. To see what other options are available for different operations, see the generic documentation for [`config.options`][].

The properties accepted in this options object may also be accepted by the [`props.mutate`][] function. Any options passed into the `mutate` function will take precedence over the options defined in the `config` object.

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

### `options.variables`

The variables which will be used to execute the mutation operation. These variables should correspond to the variables that your mutation definition accepts. If you define `config.options` as a function, or you pass variables into the [`props.mutate`][] function then you may compute your variables from props and component state.

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

### `options.optimisticResponse`

Often when you mutate data it is fairly easy to predict what the response of the mutation will be before asking your server. The optimistic response option allows you to make your mutations feel faster by simulating the result of your mutation in your UI before the mutation actually finishes.

To learn more about the benefits of optimistic data and how to use it be sure to read the recipe on [Optimistic UI](/features/optimistic-ui/).

This optimistic response will be used with [`options.update`][] and [`options.updateQueries`][] to apply an update to your cache which will be rolled back before applying the update from the actual response.

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

### `options.update`

This option allows you to update your store based on your mutation’s result. By default Apollo Client will update all of the overlapping nodes in your store. Anything that shares the same id as returned by the `dataIdFromObject` you defined will be updated with the new fields from your mutation results. However, sometimes this alone is not sufficient. Sometimes you may want to update your cache in a way that is dependent on the data currently in your cache. For these updates you may use an `options.update` function.

`options.update` takes two arguments. The first is an instance of a [`DataProxy`][] object which has some methods which will allow you to interact with the data in your store. The second is the response from your mutation - either the optimistic response, or the actual response returned by your server (see the mutation result described in the [mutation render prop](#render-prop-function-1) section for more details).

In order to change the data in your store call methods on your [`DataProxy`][] instance like [`writeQuery`](/advanced/caching/#writequery-and-writefragment) and [`writeFragment`](/advanced/caching/#writequery-and-writefragment). This will update your cache and reactively re-render any of your GraphQL components which are querying affected data.

To read the data from the store that you are changing, make sure to use methods on your [`DataProxy`][] like [`readQuery`](/advanced/caching/#readquery) and [`readFragment`](/advanced/caching/#readfragment).

For more information on updating your cache after a mutation with the `options.update` function make sure to read the [Apollo Client technical documentation on the subject](/advanced/caching/#updating-after-a-mutation).

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

### `options.refetchQueries`

Sometimes when you make a mutation you also want to update the data in your queries so that your users may see an up-to-date user interface. There are more fine-grained ways to update the data in your cache which include [`options.updateQueries`][], and [`options.update`][]. However, you can update the data in your cache more reliably at the cost of efficiency by using `options.refetchQueries`.

`options.refetchQueries` will execute one or more queries using your network interface and will then normalize the results of those queries into your cache. Allowing you to potentially refetch queries you had fetched before, or fetch brand new queries.

`options.refetchQueries` is either an array of strings or objects, or a function which takes the result of the mutation and returns an array of strings or objects.

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
```js
export default graphql(gql`mutation { ... }`, {
  options: {
    refetchQueries: (mutationResult) => [
      'CommentList',
      'PostList',
    ],
  },
})(MyComponent);
```

Please note that refetched queries are handled asynchronously, and by default are not necessarily completed before the mutation has completed. If you want to make sure refetched queries are completed before the mutation is considered done (or resolved), set [`options.awaitRefetchQueries`](#optionsawaitrefetchqueries) to `true`.

### `options.awaitRefetchQueries`

Queries refetched using [`options.refetchQueries`](#optionsrefetchqueries) are handled asynchronously, which means by default they are not necessarily completed before the mutation has completed. Setting `options.awaitRefetchQueries` to `true` will make sure refetched queries are completed before the mutation is considered done (or resolved). `options.awaitRefetchQueries` is `false` by default.

### `options.updateQueries`

**Note: We recommend using [`options.update`][] instead of `updateQueries`. `updateQueries` will be removed in the next version of Apollo Client**

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

- `mutationResult`: The `mutationResult` property will represent the result of your mutation after hitting the server. If you provided an [`options.optimisticResponse`](#optionsoptimisticresponse) then `mutationResult` may be that object.
- `queryVariables`: The last set of variables that the query was executed with. This is helpful because when you specify the query name it will only update the data in the store for your current variable set.
- `queryName`: This is the name of the query you are updating. It is the same name as the key you provided to `options.updateQueries`.

The return value of your `options.updateQueries` functions _must_ have the same shape as your first `previousData` argument. However, you _must not_ mutate the `previousData` object. Instead you must create a new object with your changes. Just like in a Redux reducer.

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

## `compose(...enhancers)(component)`

```js
import { compose } from 'react-apollo';
```

For utility purposes, `react-apollo` exports a `compose` function. Using this function you may cleanly use several component enhancers at once. Including multiple [`graphql()`][], [`withApollo()`][], or [Redux `connect()`](https://github.com/reduxjs/react-redux/blob/master/docs/api/connect.md) enhancers. This should clean up your code when you use multiple enhancers. [Redux](http://redux.js.org/) also exports a `compose` function, and so does [Recompose](https://github.com/acdlite/recompose) so you may choose to use the function from whichever library feels most appropriate.

An important note is that `compose()` executes the first enhancer _first_ and works its way forwards through the list of enhancers. In other words, calling three functions like this: `funcA(funcB(funcC(component)))` is equivalent to calling `compose()` like this: `compose(funcC, funcB, funcA)(component)`.

**Example:**

```js
export default compose(
  withApollo,
  graphql(gql`query { ... }`),
  graphql(gql`mutation { ... }`),
  connect(...),
)(MyComponent);
```

## `withApollo(component)`

```js
import { withApollo } from 'react-apollo';
```

A simple enhancer which provides direct access to your [`ApolloClient`][] instance. This is useful if you want to do custom logic with Apollo. Such as calling one-off queries. By calling this function with the component you want to enhance, `withApollo()` will create a new component which passes in an instance of [`ApolloClient`][] as a `client` prop.

If you are wondering when to use `withApollo()` and when to use [`graphql()`][] the answer is that most of the time you will want to use [`graphql()`][]. [`graphql()`][] provides many of the advanced features you need to work with your GraphQL data. You should only use `withApollo()` if you want the GraphQL client without any of the other features.

This will only be able to provide access to your client if there is an [`<ApolloProvider/>`][] component higher up in your tree to actually provide the client.

**Example:**

```js
function MyComponent({ client }) {
  console.log(client);
}

export default withApollo(MyComponent);
```

[`ApolloClient`]: /api/apollo-client#apolloclient
[`DataProxy`]: /advanced/caching#direct
[`withApollo()`]: #withapollocomponent
[`<ApolloProvider/>`]: #apolloprovider
[`graphql()`]: #graphqlquery-configcomponent
[`props.mutate`]: #propsmutate
[`compose`]: #composeenhancerscomponent
[`data.loading`]: #dataloading
[`options.pollInterval`]: #optionspollinterval
[`config.options`]: #configoptions
[`options.update`]: #optionsupdate
[`options.updateQueries`]: #optionsupdatequeries
