---
title: Initialization
order: 1
---

## Installation

XXX: this is just copied over unmodified from the existing react docs

The `react-apollo` package gives a higher-order-component style interface to Apollo Client to allow you to easily integrate GraphQL data with your React components.

```txt
npm install react-apollo --save
```

> Note: You don't have to do anything special to get Apollo Client to work in React Native, just install and import it as usual.


[Follow apollostack/react-apollo on GitHub.](https://github.com/apollostack/react-apollo)


## Creating a client

To get started, you should use an `ApolloProvider` to inject an [ApolloClient instance](../apollo-client/index.html#Initializing) into your React view heirarchy, *above* the point where you need GraphQL data.

```js
import ApolloClient from 'apollo-client';
import { ApolloProvider } from 'react-apollo';

// you can provide whichever options you require to the apollo client here.
const client = new ApolloClient();

ReactDOM.render(
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>,
  rootEl
)
```

To fetch data using the client, or send mutations, use the [`graphql`](#graphql) or [`withApollo`](#withApollo) higher order components.

<h2 id="connecting-to-components">Connecting to Components</h2>

XXX: should we document `withApollo` here?


The `graphql` container is the recommended approach for fetching data or making mutations. It is a [Higher Order Component](https://facebook.github.io/react/blog/2016/07/13/mixins-considered-harmful.html#subscriptions-and-side-effects) for providing Apollo data to a component.

For queries, this means `graphql` handles the fetching and updating of information from the query using Apollo's [watchQuery method](../apollo-client/queries.html#watchQuery). For mutations, `graphql` binds the intended mutation to be called using Apollo.

The basic usage of `graphql` is as follows:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

// MyComponent is a "presentational" or apollo-unaware component,
// It could be a simple React class
class MyComponent extends Component {
  render() {
    return <div>...</div>;
  }
}
// Or a stateless functional component:
const MyComponent = (props) => <div>...</div>;

// MyComponentWithData provides the query or mutation defined by
// QUERY_OR_MUTATION to MyComponent. We'll see how below.
const withData = graphql(QUERY_OR_MUTATION, options);
const MyComponentWithData = withData(MyComponent);
```

If you are using [ES2016 decorators](https://medium.com/google-developers/exploring-es7-decorators-76ecb65fb841#.nn723s5u2), you may prefer the decorator syntax, although we'll use the older syntax in this guide:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

@graphql(QUERY_OR_MUTATION, settings)
class MyComponent extends Component {
  render() {
    return <div>...</div>;
  }
}
```


## Troubleshooting
