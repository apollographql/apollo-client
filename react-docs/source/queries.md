---
title: Querying for data
order: 3
---

To fetch data from the server in a GraphQL system


XXX: copied over from react docs, need to include
http://docs.apollostack.com/apollo-client/queries.html



The first, and only required, argument of `graphql` is a [graphql](https://www.npmjs.com/package/graphql) document. Use the `gql` template literal you can get from [graphql-tag](../apollo-client/index.html#gql) which parses the query string.

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class MyComponent extends Component {
  render() {
    // By default the result of the query will be available at `props.data`
    const { loading, user } = this.props.data;
  }
}

MyComponent.propTypes = {
  // We'll see the precise shape of this object below
  data: React.PropTypes.object.isRequired,
};

const GET_USER = gql`
  query getUser {
    user { name }
  }
`;

const withUser = graphql(GET_USER);
const MyComponentWithData = withUser(MyComponent);
```

<h4 id="default-result-props">Default Result Props</h4>

Using `graphql` with queries makes it easy to bind data to components. As seen above, `graphql` will add the result of the query as `data` to the props passed to the wrapped component (it will also pass all of the props of the parent container). The shape of the `data` prop will be the following:

- `loading: Boolean`
  Loading will be true if a query is in flight (including when calling refetch)

- [`error: ApolloError`](http://docs.apollostack.com/apollo-client/queries.html#ApolloError)
  The error key will be `null` if no errors were created during the query

- `...fields`

  One key for each field selected on the root query, so:

  ```graphql
  query getUserAndLikes(id: $ID!) {
    user(userId: $id) { name }
    likes(userId: $id) { count }
  }
  ```

  could return a result object that includes `{ user: { name: "James" }, likes: { count: 10 } }`.

- [`...QuerySubscription`](../apollo-client/queries.html#QuerySubscription)

  The subscription created on this query will be merged into the passed props so you can dynamically refetch, change polling settings, or even unsubscribe to this query. The methods include `stopPolling`, `startPolling`, `refetch`, and `fetchMore`.


<h3 id="graphql-options">Providing `options`</h3>

If you want to configure the query (or the mutation, as we'll see below), you can provide an `options` function on the second argument to `graphql`:

```js
const withUser = graphql(GET_USER, {
  // Note ownProps here are the props that are passed into `MyComponentWithData`
  // when it is used
  options(ownProps) {
    return {
      // options for ApolloClient.watchQuery
    }
  }
});

const MyComponentWithData = withUser(MyComponent);
```

By default, `graphql` will attempt to pick up any missing variables from the query from `ownProps`. For example:

```js
import { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class MyComponent extends Component { ... }

const GET_USER_WITH_ID = gql`
  query getUser(id: $ID!) {
    user { name }
  }
`;
// Even though we haven't defined where `id` comes from, as long as we call
// `<MyComponentWithData id={something} />`, the default options() will work.
const withUserFromId = graphql(GET_USER_WITH_ID);
const MyComponentWithData = withUserFromId(MyComponent);
```

In general, you will probably want to be explicit about where the variables come from:

```js
// If we'd prefer to call `<MyComponentWithData userId={something} />`
const withUserFromId = graphql(GET_USER_WITH_ID, {
  options: (ownProps) => ({ variables: { id: ownProps.userId } })
});
const MyComponentWithData = withUserFromId(MyComponent);
```

Also, you may want to configure the [watchQuery](../apollo-client/queries.html#watchQuery) behaviour using `options`:

```js
const withPollingQuery = graphql(GET_USER_WITH_ID, {
  options: () => ({ pollInterval: 1000 })
});
const MyComponentWithData = withPollingQuery(MyComponent);
```

Sometimes you may want to skip a query based on the available information, to do this you can pass `skip: true` as part of the options. This is useful if you want to ignore a query if a user isn't authenticated:

```js
const withUser = graphql(GET_USER_DATA, {
  options: (ownProps) => ({ skip: !ownProps.authenticated })
});
const MyComponentWithData = withUser(MyComponent);
```

When the props change (a user logs in for instance), the query options will be rerun and `react-apollo` will start the watchQuery on the operation.

<h3 id="graphql-props">Controlling child props</h3>

As [we've seen](#default-result-props), by default, `graphql` will provide a `data` prop to the wrapped component with various information about the state of the query. We'll also see that [mutations](#graphql-mutations) provide a callback on the `mutate` prop.

<h4 id="graphql-name">Using `name`</h4>

If you want to change the name of this default property, you can use `name` field. In particular this is useful for nested `graphql` containers:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';

class MyComponent extends Component { ... }
MyComponent.propTypes = {
  upvote: React.PropTypes.func.isRequired,
  downvote: React.PropTypes.func.isRequired,
};

// This provides an `upvote` callback prop to `MyComponent`
const withUpVote = graphql(UPVOTE, { name: 'upvote' });
const MyComponentWithUpvote = withUpVote(MyComponent);

// This provides an `downvote` callback prop to `MyComponentWithUpvote`,
// and subsequently `MyComponent`
const withDownVote = graphql(DOWNVOTE, { name: 'downvote' });
const MyComponentWithUpvoteAndDownvote = withDownVote(MyComponentWithUpvote);
```


<h4 id="graphql-props">Using `props`</h4>

If you want a greater level of control, use the `props` to map the query results (or mutation, as we'll see [below](#graphql-mutations)) to the props to be passed to the child component:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

class MyComponent extends Component { ... }

MyComponent.propTypes = {
  loading: React.PropTypes.boolean,
  hasErrors: React.PropTypes.boolean,
  currentUser: React.PropTypes.object,
  refetchUser: React.PropTypes.func,
};

const GET_USER_WITH_ID = gql`
  query getUser(id: $ID!) {
    user { name }
  }
`;

const withUserFromId = graphql(GET_USER_WITH_ID, {
  // `ownProps` are the props passed into `MyComponentWithData`
  // `data` is the result data (see above)
  props: ({ ownProps, data }) => {
    if (data.loading) return { userLoading: true };
    if (data.error) return { hasErrors: true };
    return {
      currentUser: data.user,
      refetchUser: data.refetch,
    };
  }
});
const MyComponentWithData = withUserFromId(MyComponent);
```

This style of usage leads to the greatest decoupling between your presentational component (`MyComponent`) and Apollo.
