---
title: Setup and options
---
<h2 id="installation">Installation</h2>

To get started with Apollo and React, install the `apollo-client` npm package, the `react-apollo` integration package, and the `graphql-tag` library for constructing query documents:

```bash
npm install react-apollo --save
```

> Note: You don't have to do anything special to get Apollo Client to work in React Native, just install and import it as usual.

To get started using Apollo with React, we need to create an `ApolloClient` and an `ApolloProvider`. `ApolloClient` serves as a central store of query result data which caches and distributes the results of our queries. `ApolloProvider` wires that client into our React component hierarchy.

<h2 id="creating-client">Creating a client</h2>

To get started, create an [`ApolloClient`](/core/apollo-client-api.html#constructor) instance and point it at your GraphQL server:

```js
import { ApolloClient } from 'react-apollo';

// By default, this client will send queries to the
//  `/graphql` endpoint on the same host
const client = new ApolloClient();
```

The client takes a variety of [options](/core/apollo-client-api.html#constructor), but in particular, if you want to change the URL of the GraphQL server, you can create a custom [`NetworkInterface`](/core/apollo-client-api.html#NetworkInterface):

```js
import { ApolloClient, createNetworkInterface } from 'react-apollo';

const client = new ApolloClient({
  networkInterface: createNetworkInterface({ uri: 'http://my-api.graphql.com' }),
});
```

`ApolloClient` has some other options which control the behavior of the client, and we'll see examples of their use throughout this guide.

<h2 id="creating-provider">Creating a provider</h2>

To connect your client instance to your component tree, use an `ApolloProvider` component. You should be sure to place the `ApolloProvider` somewhere high in your view hierarchy, above any places where you need to access GraphQL data.

```js
import { ApolloClient, ApolloProvider } from 'react-apollo';

// Create the client as outlined above
const client = new ApolloClient();

ReactDOM.render(
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  domContainerNode
)
```

<h2 id="connecting-data">Connecting Data</h2>

The `graphql()` container is the recommended approach for fetching data or making mutations. It is a [Higher Order Component](https://facebook.github.io/react/blog/2016/07/13/mixins-considered-harmful.html#subscriptions-and-side-effects) for providing Apollo data to a component, or attaching mutations.

The basic usage of `graphql()` is as follows:

```js
import React, { Component } from 'react';
import { gql, graphql } from 'react-apollo';

// MyComponent is a "presentational" or apollo-unaware component,
// It could be a simple React class:
class MyComponent extends Component {
  render() {
    return <div>...</div>;
  }
}
// Or a stateless functional component:
const MyComponent = (props) => (
  <div>...</div>
);

// Initialize GraphQL queries or mutations with the `gql` tag
const MyQuery = gql`query MyQuery { todos { text } }`;
const MyMutation = gql`mutation MyMutation { addTodo(text: "Test 123") { id } }`;

// We then can use `graphql` to pass the query results returned by MyQuery
// to MyComponent as a prop (and update them as the results change)
const MyComponentWithData = graphql(MyQuery)(MyComponent);

// Or, we can bind the execution of MyMutation to a prop
const MyComponentWithMutation = graphql(MyMutation)(MyComponent);
```

If you are using [ES2016 decorators](https://medium.com/google-developers/exploring-es7-decorators-76ecb65fb841#.nn723s5u2), you may prefer the decorator syntax:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

@graphql(MyQuery)
@graphql(MyMutation)
class MyComponent extends Component {
  render() {
    return <div>...</div>;
  }
}
```

In this guide, we won't use the decorator syntax to make the code more familiar, but you can always use it if you prefer.

To see the complete API for the `graphql()` function be sure to checkout the [API reference](api.html#graphql).

<!--  Add content here once it exists -->
<!-- ## Troubleshooting -->
