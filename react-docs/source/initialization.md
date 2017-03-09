---
title: Setup and options
---
<h2 id="installation">Installation</h2>

To get started with Apollo and React, install the `apollo-client` npm package, the `react-apollo` integration package, and the `graphql-tag` library for constructing query documents:

```bash
npm install apollo-client react-apollo graphql-tag --save
```

If you are in an environment that does not have a global [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch/fetch) implementation, make sure to install a polyfill like [`whatwg-fetch`](https://www.npmjs.com/package/whatwg-fetch).

> Note: You don't have to do anything special to get Apollo Client to work in React Native, just install and import it as usual.

<h2 id="initialization">Initialization</h2>

To get started using Apollo with React, we need to create an `ApolloClient` and an `ApolloProvider`. `ApolloClient` serves as a central store of query result data which caches and distributes the results of our queries. `ApolloProvider` wires that client into our React component hierarchy.

<h3 id="creating-client">Creating a client</h3>

To get started, create an [`ApolloClient`](/core/apollo-client-api.html#constructor) instance and point it at your GraphQL server:

```js
import ApolloClient from 'apollo-client';

// By default, this client will send queries to the
//  `/graphql` endpoint on the same host
const client = new ApolloClient();
```

The client takes a variety of [options](/core/apollo-client-api.html#constructor), but in particular, if you want to change the URL of the GraphQL server, you can create a custom [`NetworkInterface`](/core/apollo-client-api.html#NetworkInterface):

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const client = new ApolloClient({
  networkInterface: createNetworkInterface({ uri: 'http://my-api.graphql.com' }),
});
```

`ApolloClient` has some other options which control the behavior of the client, and we'll see examples of their use throughout this guide.

<h3 id="creating-provider">Creating a provider</h3>

To connect your client instance to your component tree, use an `ApolloProvider` component. You should be sure to place the `ApolloProvider` somewhere high in your view hierarchy, above any places where you need to access GraphQL data.

```js
import ApolloClient from 'apollo-client';
import { ApolloProvider } from 'react-apollo';

// Create the client as outlined above
const client = new ApolloClient();

ReactDOM.render(
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  domContainerNode
)
```

<!--  Add content here once it exists -->
<!-- ## Troubleshooting -->
