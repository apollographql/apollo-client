---
title: Initialization
order: 2
---
<h2 id="installation">Installation</h2>

To get started with Apollo and React, install the `apollo-client` npm package, the `react-apollo` integration package, and the `graphql-tag` library for constructing query documents:

```bash
npm install apollo-client react-apollo graphql-tag --save
```

> Note: You don't have to do anything special to get Apollo Client to work in React Native, just install and import it as usual.

<h2 id="initialization">Initialization</h2>

To get started using Apollo, we need to create an `ApolloClient` and an `ApolloProvider`. `ApolloClient` serves as a central store of query result data which caches and distributes the results of our queries. `ApolloProvider` wires that client into our React component hierarchy.

<h3 id="creating-client">Creating a client</h3>

To get started, create an [`ApolloClient`](/core/apollo-client-api.html#constructor) instance and point it at your GraphQL server:

```js
import ApolloClient from 'apollo-client';

// by default, this client will send queries to `/graphql` (relative to the URL of your app)
const client = new ApolloClient();
```

The client takes a variety of [options](/core/apollo-client-api.html#constructor), but in particular, if you want to change the URL of the GraphQL server, you can pass in a custom [`NetworkInterface`](/core/apollo-client-api.html#NetworkInterface):

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

// by default, this client will send queries to `/graphql` (relative to the URL of your app)
const client = new ApolloClient({
  networkInterface: createNetworkInterface('http://my-api.grapql.com'),
});
```

The other options control the behavior of the client, and we'll see examples of their use throughout this guide.

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
  rootEl
)
```

<h2 id="connecting-to-components">Connecting to Components</h2>

The `graphql` container is the recommended approach for fetching data or making mutations. It is a [Higher Order Component](https://facebook.github.io/react/blog/2016/07/13/mixins-considered-harmful.html#subscriptions-and-side-effects) for providing Apollo data to a component, or attaching mutations.

The basic usage of `graphql` is as follows:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

// MyComponent is a "presentational" or apollo-unaware component,
// It could be a simple React class:
class MyComponent extends Component {
  render() {
    return <div>...</div>;
  }
}
// Or a stateless functional component:
const MyComponent = (props) => <div>...</div>;

const MyQuery = gql`query { todos { text } }`;
const MyMutation = gql`mutation { addTodo(text: "Test 123") }`;

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
In this guide, we'll use separate components for instructional purposes.

<h3 id="withApollo">The `withApollo` container</h3>

`withApollo` is a simple higher order component which provides direct access to your `ApolloClient` instance as a prop to your wrapped component. This is useful if you want to do custom logic with apollo, without using the `graphql` container.

```js
import React, { Component } from 'react';
import { withApollo } from 'react-apollo';
import ApolloClient from 'apollo-client';

class MyComponent extends Component { ... }
MyComponent.propTypes = {
  client: React.PropTypes.instanceOf(ApolloClient).isRequired;
}
const MyComponentWithApollo = withApollo(MyComponent);

// or using ES2016 decorators:
@withApollo
class MyComponent extends Component { ... }
```

<h3 name='with-ref'>withRef</h3>

If you need to get access to the instance of the wrapped component, you can use `withRef` in the options.
This will allow a `getWrappedInstance` method on the returned component which will return the wrapped instance.

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

class MyComponent extends Component { ... }

const MyComponentWithUpvote = graphql(Upvote, { withRef: 'true' })(MyComponent);

// MyComponentWithUpvote.getWrappedInstance() returns MyComponent instance
```

<!--  Add content here once it exists -->
<!-- ## Troubleshooting -->
