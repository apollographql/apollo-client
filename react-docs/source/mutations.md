---
title: Modifying data on the server
order: 4
---

XXX: just copied over from old docs, need to also integrate apollo-client mutation docs

http://docs.apollostack.com/apollo-client/mutations.html


## Basics
## Optimistic UI


Using `graphql` with mutations makes it easy to bind actions to components. Unlike queries, mutations provide only a simple prop (the `mutate` function) to the wrapped component. When calling a mutation, you can pass an options that can be passed to the Apollo Client [`mutate` method](../apollo-client/mutations.html#mutate).

Mutations will be passed to the child as `props.mutate`:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class MyComponent extends Component { ... }

MyComponent.propTypes = {
  mutate: React.PropTypes.func.isRequired,
};

const ADD_TASK = gql`
  mutation addTask($text: String!, $list_id: ID!) {
    addNewTask(text: $text, list_id: $list_id) {
      id
      text
      completed
      createdAt
    }
  }
`;

const withAddTask = graphql(ADD_TASK);
const MyComponentWithMutation = withAddTask(MyComponent);
```

<h4 id="calling-mutations">Calling mutations</h4>

Most mutations will require arguments in the form of query variables, and you may wish to provide other options to [ApolloClient#mutate](../apollo-client/mutations.html#mutate), such as `optimisticResponse` or `updateQueries`.

You can directly pass options to `mutate` when you call it in the wrapped component:

```js
import React, { Component } from 'react';

class MyComponent extends Component {
  render() {
    const onClick = () => {
      // pass in extra / changed variables
      this.props.mutate({ variables: { text: "task", list_id: 1 } })
        .then(({ data }) => {
          console.log('got data', data);
        }).catch((error) => {
          console.log('there was an error sending the query', error);
        });      
    }

    return <div onClick={onClick}>Click me</div>;
  }
}

MyComponent.propTypes = {
  mutate: React.PropTypes.func.isRequired,
};
```

However, typically you'd want to keep the concern of understanding the query out of your presentational component. The best way to do this is to use the [`props`](#graphql-props) argument to bind your mutate function:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

class MyComponent extends Component {
  render() {
    const onClick = () => {
      this.props.addTask("text");
    }

    return <div onClick={onClick}>Click me</div>;
  }
}

MyComponent.propTypes = {
  addTask: React.PropTypes.func.isRequired,
};

const ADD_TASK = ...;

const withAddTask = graphql(ADD_TASK, {
  props: ({ ownProps, mutate }) => ({
    addTask(text) {
      return mutate({
        variables: { text, list_id: 1 },
        optimisticResponse: {
          id: '123',
          text,
          completed:
          true,
          createdAt: new Date(),
        },

      // Depending on what you do it may make sense to deal with
      // the promise result in the container or the presentational component
      }).then(({ data }) => {
        console.log('got data', data);
      }).catch((error) => {
        console.log('there was an error sending the query', error);
      });     
    },
  })
});
const MyComponentWithMutation = withAddTask(MyComponent);
```

> Note that in general you shouldn't attempt to use the results from the mutation callback directly, but instead write a [`updateQueries`](../apollo-client/mutations.html#updating-query-results) callback to update the result of relevant queries with your mutation results.


<h4 name='with-ref'>withRef</h4>

If you need to get access to the instance of the wrapped component, you can use `withRef` in the options.
This will allow a `getWrappedInstance` method on the returned component which will return the wrapped instance.

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

class MyComponent extends Component { ... }

const withUpvoteAndRef = graphql(UPVOTE, { withRef: 'true' });
const MyComponentWithUpvote = withUpvoteAndRef(MyComponent);

// MyComponentWithUpvote.getWrappedInstance() returns MyComponent instance
```

<h2 id="withApollo">The `withApollo` container</h2>

`withApollo` is a simple higher order component which provides direct access to your `ApolloClient` instance as a prop to your wrapped component. This is useful if you want to do custom logic with apollo, without using the `graphql` container.

```js
import React, { Component } from 'react';
import { withApollo } from 'react-apollo';
import { ApolloClient } from 'apollo-client';

const MyComponent = (props) => {
  // this.props.client is the apollo client
  return <div></div>
}
MyComponent.propTypes = {
  client: React.PropTypes.instanceOf(ApolloClient).isRequired;
}
const MyComponentWithApollo = withApollo(MyComponent);

// or, using ES2016 decorators:

@withApollo
class MyComponent extends Component {
  render() {
    return <div></div>
  }
}
```
