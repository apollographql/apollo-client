---
title: Queries
---

On this page, you can learn how to use `react-apollo` to attach GraphQL query results to your React UI. You can read about GraphQL queries themselves in detail at [graphql.org](http://graphql.org/docs/queries/).

Note that when using `react-apollo`, you don't have to learn anything special about the query syntax, since everything is just standard GraphQL. Anything you can type into the GraphiQL query explorer, you can also put into your `react-apollo` code.

<h2 id="basics">Basic Queries</h2>

When we are running a basic query we can use the `graphql` container in a very simple way. We simply parse our query into a GraphQL document using the `graphql-tag` library, and then pass it into the `graphql` container as the first argument.

For instance, in GitHunt, we want to display the currently logged-in user in the `Profile` component:

```js
import React, { Component, PropTypes } from 'react';
import { gql, graphql } from 'react-apollo';

class Profile extends Component { ... }

Profile.propTypes = {
  data: PropTypes.shape({
    loading: PropTypes.bool.isRequired,
    currentUser: PropTypes.object,
  }).isRequired,
};

// We use the gql tag to parse our query string into a query document
const CurrentUserForLayout = gql`
  query CurrentUserForLayout {
    currentUser {
      login
      avatar_url
    }
  }
`;

const ProfileWithData = graphql(CurrentUserForLayout)(Profile);
```

When we use `graphql` in this simple way with a GraphQL query document, [`ApolloClient.watchQuery`](/core/apollo-client-api.html#watchQuery) is used under the hood to execute the query before the results are passed to the child component in a prop called `data`. In addition to the `currentUser` field selected in the query, the `data` prop also includes a field called `loading`, a Boolean value indicating if the the query is currently being loaded from the server.

The `data.currentUser` sub-prop will change as what the client knows about the current user changes over time. That information is stored in Apollo Client's global cache, so if some other query fetches new information about the current user, this component will update to remain consistent. You can read more about techniques to bring the cache up to date with the server in the [article on the subject](cache-updates.html).

<h2 id="default-result-props">The structure of the `data` prop</h2>

As seen above, `graphql` will pass the result of the query to the wrapped component in a prop called `data`. It will also pass through all of the props of the parent container.

For queries, the shape of the `data` prop is the following:

- `...fields`: One key for each root field in the query.
- `loading`: This field is `true` if there is currently a query fetch in flight, including after calling `refetch`. `false` otherwise.
- `error`: An ApolloError object that represents the different possible errors that might happen when running a query.
- `...QuerySubscription`: All of the methods from the Apollo [QuerySubscription object](/core/apollo-client-api.html#QuerySubscription), including `stopPolling`, `startPolling`, `refetch`, `fetchMore`, and others.

Here's a complete example. For a query like this:

```graphql
query getUserAndLikes($id: ID!) {
  user(userId: $id) { name }
  likes(userId: $id) { count }
}
```

You would get a prop like:

```js
data: {
  user: { name: "James" },
  likes: { count: 10 },
  loading: false,
  error: null,
  refetch() { ... },
  fetchMore() { ... },
  startPolling() { ... },
  stopPolling() { ... },
  // ... more methods from the QuerySubscription object
}
```

If you use the `props` option to the wrapper to specify [custom `props`](#graphql-props) for your child component, this object will be passed to the `props` option on the parameter named `data`.

<h2 id="graphql-options">Query options</h2>

If you want to configure the query, you can provide an `options` key on the second argument to `graphql`, and your options will be passed along to [`ApolloClient.watchQuery`](/core/apollo-client-api.html#watchQuery). If your query takes variables, this is the place to pass them in:

```js
// Suppose our profile query took an avatar size
const CurrentUserForLayout = gql`
  query CurrentUserForLayout($avatarSize: Int!) {
    currentUser {
      login
      avatar_url(avatarSize: $avatarSize)
    }
  }
`;

const ProfileWithData = graphql(CurrentUserForLayout, {
  options: { variables: { avatarSize: 100 } },
})(Profile);

```

Typically, variables to the query will be configured by the `props` of the wrapper component; where ever the component is used in your application, the caller would pass arguments. So `options` can be a function that takes the props of the outer component (`ownProps` by convention):

```js
// The caller could do something like:
<ProfileWithData avatarSize={300} />

// And our HOC could look like:
const ProfileWithData = graphql(CurrentUserForLayout, {
  options: ({ avatarSize }) => ({ variables: { avatarSize } }),
})(Profile);
```

By default, `graphql` will attempt to pick up any missing variables from the query from `ownProps`. So in our example above, we could have used the simpler `ProfileWithData = graphql(CurrentUserForLayout)(Profile);`. However, if you need to change the name of a variable, or compute the value (or just want to be more explicit about things), the `options` function is the place to do it.

<h3 id="other-graphql-options">Other `watchQuery` `options`</h3>

You may want to configure the options used by Apollo's [watchQuery](/core/apollo-client-api.html#watchQuery) using `options`:

```js
const ProfileWithData = graphql(CurrentUserForLayout, {
  // See the watchQuery API for the options you can provide here
  options: { pollInterval: 20000 },
})(Profile);
```

All of these function-based forms of `options` will be recalculated whenever the props change.

<h2 id="graphql-skip">Skipping an operation</h2>

Sometimes you may want to skip a query based on the available information. To do this you can pass `skip: true` as part of the options. This is useful if you want to ignore a query if a user isn't authenticated:

```js
const ProfileWithData = graphql(CurrentUserForLayout, {
  skip: (ownProps) => !ownProps.authenticated,
})(Profile);
```

This can also be represented as an object instead of a method that takes props:

```js
const ProfileWithData = graphql(CurrentUserForLayout, {
  skip: true,
})(Profile);
```

> This does not pass `data` or run the `options` or `props` methods if passed. It effectively bypasses the HOC.


<h2 id="graphql-props">Controlling child props</h2>

By default, `graphql` will provide a `data` prop to the wrapped component with various information about the state of the query. We'll also see that [mutations](mutations.html) provide a callback on the `mutate` prop. Thus, it's possible to write your whole app just using these default prop names.

If you want to decouple your UI components from Apollo and make them more reusable, you may want to modify these default props into your own custom objects and functions.

<h3 id="graphql-name">Using `name`</h3>

If you want to change the name of the default `data` prop, but keep the exact same shape, you can use `name` option to the `graphql` container. This is especially useful for nested `graphql` containers, where the `data` prop would clash between them.

```js
import React, { Component, PropTypes } from 'react';
import { gql, graphql } from 'react-apollo';

class Profile extends Component { ... }
Profile.propTypes = {
  CurrentUserForLayout: PropTypes.shape({
    loading: PropTypes.bool.isRequired,
    currentUser: PropTypes.object,
  }).isRequired,
};

const CurrentUserForLayout = gql`
  query CurrentUserForLayout {
    currentUser {
      login
      avatar_url
    }
  }
`;

// We want the prop to be called 'CurrentUserForLayout' instead of data
const ProfileWithData = graphql(CurrentUserForLayout, {
  name: 'CurrentUserForLayout'
})(Profile);
```

<h3 id="graphql-props-option">Using `props`</h3>

If you want complete control over the props of the child component, use the `props` option to map the query `data` object into any number of props that will be passed into the child:

```js

import React, { Component, PropTypes } from 'react';
import { gql, graphql } from 'react-apollo';

// Here Profile has a more generic API, that's not coupled to Apollo or the
// shape of the query that we've used
class Profile extends Component { ... }
Profile.propTypes = {
  userLoading: PropTypes.bool.isRequired,
  user: PropTypes.object,
  refetchUser: PropTypes.func,
};


const CurrentUserForLayout = gql`
  query CurrentUserForLayout {
    currentUser {
      login
      avatar_url
    }
  }
`;

const ProfileWithData = graphql(CurrentUserForLayout, {
  // ownProps are the props that are passed into the `ProfileWithData`
  // when it is used by a parent component
  props: ({ ownProps, data: { loading, currentUser, refetch } }) => ({
    userLoading: loading,
    user: currentUser,
    refetchUser: refetch,
  }),
})(Profile);
```

This style of usage leads to the greatest decoupling between your presentational component (`Profile`) and Apollo.

* * *

For more information about all of the options and features supported by React Apollo for GraphQL queries be sure to review the [API reference on `graphql()` queries](api.html#queries).
