---
title: Connecting data
---

Now that we have created an `ApolloClient` instance and attached it to our UI tree with `ApolloProvider`, we can start using the main function of `react-apollo`: adding GraphQL functionality to our UI components.

<h2 id="graphql">`graphql`</h2>

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

<h3 id="graphql-api">Complete API</h3>

The `graphql` function takes two arguments:

- `query`: Required, a GraphQL document parsed with the `gql` tag
- `config`: An optional object with configuration, as described below

The config object can include one or more of the following keys:

- `name`: Rename the prop the higher-order-component passes down to something else
- `options`: Pass options about the query or mutation, documented in the [queries](/react/queries.html) and [mutations](/react/mutations.html) guides
- `props`: Modify the props before they are passed into the child component
- `withRef`: Add a method to access the child component to the container, [read more below](#with-ref)
- `shouldResubscribe`: A function which gets called with current props and next props when props change. The function should return true if the change requires the component to resubscribe.

The `graphql` function returns another function, which takes any React component and returns a new React component class wrapped with the specified query. This is similar to how `connect` works in Redux.

For details about how to use the `graphql` higher-order-component in a variety of situations, read about how to use it with [queries](/react/queries.html) and [mutations](/react/mutations.html).

<h2 id="withApollo">withApollo</h2>

`withApollo` is a simple higher order component which provides direct access to your `ApolloClient` instance as a prop to your wrapped component. This is useful if you want to do custom logic with apollo, such as calling one-off queries, without using the `graphql` container.

```js
import React, { Component } from 'react';
import { withApollo } from 'react-apollo';
import ApolloClient from 'apollo-client';

class MyComponent extends Component { ... }
MyComponent.propTypes = {
  client: React.PropTypes.instanceOf(ApolloClient).isRequired,
}

const MyComponentWithApollo = withApollo(MyComponent);

// or using ES2016 decorators:
@withApollo
class MyComponent extends Component { ... }
```

<h2 id='with-ref'>withRef</h2>

If you need to get access to the instance of the wrapped component, you can use `withRef` in the options.
This will allow a `getWrappedInstance` method on the returned component which will return the wrapped instance.

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

class MyComponent extends Component { ... }

const MyComponentWithUpvote = graphql(Upvote, {
  withRef: true,
})(MyComponent);

// MyComponentWithUpvote.getWrappedInstance() returns MyComponent instance
```

<h2 id='compose'>compose</h2>

`react-apollo` exports a `compose` function. Adopting the following pattern allows you to reduce the number of reassignments you're doing every time you wrap your component with `graphql` and often `connect` from `react-redux`.

```js
import { graphql, compose } from 'react-apollo';
import { connect } from 'react-redux';

export default compose(
  graphql(query, queryOptions),
  graphql(mutation, mutationOptions),
  connect(mapStateToProps, mapDispatchToProps)
)(Component);
```


