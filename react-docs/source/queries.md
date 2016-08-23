---
title: Querying for data
order: 3
---

To fetch data from the server in a GraphQL system, we use GraphQL queries (you can read about the structure of GraphQL queries in detail at [graphql.org](XXX)).

<h2 id="basics">Basic Queries</h2>

When we are using a basic query we can use the `graphql` container in a very simple way. We simply need to parse our query into a GraphQL document using the [graphql-tag](../apollo-client/index.html#gql) library.

For instance, in GitHunt, we want to display the current user (if logged in) in the `Profile` component:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

function Profile({ data: { loading, currentUser } }) { ... }

const PROFILE_QUERY = gql`
  query CurrentUserForLayout {
    currentUser {
      login
      avatar_url
    }
  }
`;

const withProfileData = graphql(PROFILE_QUERY);
const ProfileWithData = withProfileData(Profile);
```

When we use `graphql` in this simple way with a GraphQL query document, the results are made available on a generic `data` prop on the child component (`Profile` in this case). In this case we can see that result object contains `loading`, a Boolean indicating if the the query is "in-flight", and (once the query has completed) `currentUser`, the field we've picked out in `PROFILE_QUERY`.

We can expect the `data.currentUser` sub-prop to change as the logged-in-ness of the client and what it knows about the current user changes over time. That information is stored in Apollo Client's cache, and you can read more about techniques to bring the cache up to date with the server in the [article on the subject](cache-updates.html).

<h3 id="graphql-options">Providing `options`</h3>

If you want to configure the query, you can provide an `options` key on the second argument to `graphql`, and your options will be passed to [`ApolloClient.watchQuery`](apollo-client-api.html#watchQuery). In particular, if your query takes variables, this is the place to pass them in:

```js
// Suppose our profile query took an avatar size
const PROFILE_QUERY = gql`
  query CurrentUserForLayout($avatarSize: Int!) {
    currentUser {
      login
      avatar_url(avatarSize: $avatarSize)
    }
  }
`;

const withProfileData = graphql(PROFILE_QUERY, {
  options: { variables: { avatarSize: 100 } },
});
```

Typically, variables to the query will be configured by the `props` of the wrapper component; where ever the component is used in your application, the caller would pass arguments. So `options` can be a function that takes the props of the outer component (`ownProps` by convention):

```js
// The caller could do something like:
<ProfileWithData avatarSize={300} />

// And our HOC could look like:
const withProfileData = graphql(PROFILE_QUERY, {
  options: ({ avatarSize }) => ({ variables: { avatarSize } }),
});
const ProfileWithData = withProfileData(Profile);
```

By default, `graphql` will attempt to pick up any missing variables from the query from `ownProps`. So in our example above, we could have used the simpler `withProfileData = graphql(PROFILE_QUERY);`. However, if you need to change the name of a variable, or compute the value, the `options` function is the place to do it.

<h3 id="other-graphql-options">Other `options`</h3>

Also, you may want to configure the [watchQuery](apollo-client-api.html#watchQuery) behaviour using `options`:

```js
const withPollingQuery = graphql(PROFILE_QUERY, {
  options: () => ({ pollInterval: 1000 })
});
```

Sometimes you may want to skip a query based on the available information, to do this you can pass `skip: true` as part of the options. This is useful if you want to ignore a query if a user isn't authenticated:

```js
const withProfileData = graphql(PROFILE_QUERY, {
  options: (ownProps) => ({ skip: !ownProps.authenticated })
});
```

All of these function-based forms of `options` will be recalculated whenever the props change.

<h2 id="graphql-props">Controlling child props</h2>

As we've seen, by default, `graphql` will provide a `data` prop to the wrapped component with various information about the state of the query. We'll also see that [mutations](mutations.html) provide a callback on the `mutate` prop. However, if you want to decouple your presentational component from Apollo, and make it more reusable, you may want more control over the props passed into it.

<h3 id="graphql-name">Using `name`</h3>

If you want to change the name of this default property, you can use `name` field. In particular this is useful for nested `graphql` containers:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

// If we want the data at `CurrentUserForLayout`
function Profile({ currentUserData: { loading, currentUser } }) { ... }

const PROFILE_QUERY = gql`
  query CurrentUserForLayout {
    currentUser {
      login
      avatar_url
    }
  }
`;

const withProfileData = graphql(PROFILE_QUERY, { name: 'CurrentUserForLayout' });
const ProfileWithData = withProfileData(Profile);
```


<h3 id="graphql-props">Using `props`</h3>

If you want a greater level of control, use `props` to map the query results to the props to be passed to the child component:

```js

import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

// Here Profile has a more generic API, that's not coupled to Apollo
function Profile({ userLoading, user, refetchUser }) { ... }

const PROFILE_QUERY = gql`
  query CurrentUserForLayout {
    currentUser {
      login
      avatar_url
    }
  }
`;

const withProfileData = graphql(PROFILE_QUERY, {
  props({ data: { loading, currentUser, refetch } }) => ({
    userLoading: loading,
    user: currentUser,
    refetchUser: refetch,
  }),
});
const ProfileWithData = withProfileData(Profile);
```

This style of usage leads to the greatest decoupling between your presentational component (`Profile`) and Apollo.


<h2 id="default-result-props">The structure of the `data` prop</h2>

Using `graphql` with queries makes it easy to bind data to components. As seen above, `graphql` will add the result of the query as `data` to the props passed to the wrapped component (it will also pass all of the props of the parent container). The shape of the `data` prop will be the following:

- `loading: Boolean`
  Loading will be true if a query is in flight (including when calling refetch)

- [`error: ApolloError`](apollo-client-api.html#ApolloError)
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

- [`...QuerySubscription`](apollo-client-api.html#QuerySubscription)

  The subscription created on this query will be merged into the passed props so you can dynamically refetch, change polling settings, or even unsubscribe to this query. The methods include `stopPolling`, `startPolling`, `refetch`, and `fetchMore`.
