---
title: General
---

The API section is a complete reference of every single feature available in React Apollo. If you are just getting started with React Apollo then you should read "usage" articles starting at [Queries](queries.html) first, and come back to this API reference when you need to look up a particular method.

<h2 id="core">Core</h2>

These APIs are not React-specific, but every React developer using Apollo needs to be aware of them.

<h3 id="gql">``gql`{ ... }` ``</h3>

```js
import { gql } from 'react-apollo';
```

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

<h3 id="ApolloClient">`ApolloClient`</h3>

```js
import { ApolloClient } from 'react-apollo';
```

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

<h3 id="createNetworkInterface">`createNetworkInterface(config)`</h3>

```js
import { createNetworkInterface } from 'react-apollo';
```

The `createNetworkInterface()` function creates a simple HTTP network interface using the provided configuration object which includes the URI Apollo will use to fetch GraphQL from.

For convenience `createNetworkInterface()` is exported by `react-apollo` from the core Apollo Client package.

[To learn more about `createNetworkInterface` and network interfaces in general go to the core documentation site.](../core/network.html)

**Example:**

```js
const networkInterface = createNetworkInterface({
  uri: '/graphql',
});
```

<h2 id="client-management">Client management</h2>

React-Apollo includes a component for providing a client instance to a React component tree, and a higher-order component for retrieving that client instance.

<h3 id="ApolloProvider" title="ApolloProvider">`<ApolloProvider client={client} />`</h3>

```js
import { ApolloProvider } from 'react-apollo';
```

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

<h3 id="withApollo">`withApollo(component)`</h3>

```js
import { withApollo } from 'react-apollo';
```

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
