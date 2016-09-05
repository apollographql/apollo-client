---
title: Queries
order: 10
---

To fetch data from the server in a GraphQL system, we use GraphQL queries (you can read about the structure of GraphQL queries in detail at [graphql.org](http://graphql.org/docs/queries/)).

<h2 id="basics">Basic Queries</h2>

When we are using a basic query we can use the `graphql` container in a very simple way. We simply need to parse our query into a GraphQL document using the `graphql-tag` library.

For instance, in GitHunt, we want to display the current user (if logged in) in the `Profile` component:

```js
import React, { Component, PropTypes } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

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

When we use `graphql` in this simple way with a GraphQL query document, the results are made available on a generic `data` prop on the child component (`Profile` in this case). In this case we can see that result object contains `loading`, a Boolean indicating if the the query is "in-flight", and (once the query has completed) `currentUser`, the field we've picked out in `CurrentUserForLayout`.

We can expect the `data.currentUser` sub-prop to change as the logged-in-ness of the client and what it knows about the current user changes over time. That information is stored in Apollo Client's cache, and you can read more about techniques to bring the cache up to date with the server in the [article on the subject](cache-updates.html).

<h2 id="default-result-props">The structure of the `data` prop</h2>

Using `graphql` with queries makes it easy to bind data to components. As seen above, `graphql` will add the result of the query as `data` to the props passed to the wrapped component (it will also pass through all of the props of the parent container). The shape of the `data` prop will be the following:

- `loading: Boolean`
  Loading will be true if a query is in flight (including when calling refetch).

- [`error: ApolloError`](/core/apollo-client-api.html#ApolloError)
  The error key will be `null` if no errors were created during the query.

- `...fields`

  One key for each field selected on the root query, so:

  ```graphql
  query getUserAndLikes(id: $ID!) {
    user(userId: $id) { name }
    likes(userId: $id) { count }
  }
  ```

  could return a result object that includes `{ user: { name: "James" }, likes: { count: 10 } }`.

- [`...QuerySubscription`](/core/apollo-client-api.html#QuerySubscription)

  The subscription created on this query will be merged into the passed props so you can dynamically refetch, change polling settings, or even unsubscribe to this query. The methods include `stopPolling`, `startPolling`, `refetch`, and `fetchMore`.

Note that if you create [custom `props`](#graphql-props) for your child component, this object will be passed to the `props` function on the parameter named `data`.

<h2 id="graphql-options">Providing `options`</h2>

If you want to configure the query, you can provide an `options` key on the second argument to `graphql`, and your options will be passed to [`ApolloClient.watchQuery`](/core/apollo-client-api.html#watchQuery). If your query takes variables, this is the place to pass them in:

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

Sometimes you may want to skip a query based on the available information, to do this you can pass `skip: true` as part of the options. This is useful if you want to ignore a query if a user isn't authenticated:

```js
const ProfileWithData = graphql(CurrentUserForLayout, {
  options: (ownProps) => ({ skip: !ownProps.authenticated })
})(Profile);
```

All of these function-based forms of `options` will be recalculated whenever the props change.

<h2 id="graphql-props">Controlling child props</h2>

As we've seen, by default, `graphql` will provide a `data` prop to the wrapped component with various information about the state of the query. We'll also see that [mutations](mutations.html) provide a callback on the `mutate` prop. However, if you want to decouple your presentational component from Apollo, and make it more reusable, you may want more control over the props passed into it.

<h3 id="graphql-name">Using `name`</h3>

If you want to change the name of this default property, you can use `name` field. In particular this is useful for nested `graphql` containers:

```js
import React, { Component, PropTypes } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

// If we want the data at `CurrentUserForLayout`
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

const ProfileWithData = graphql(CurrentUserForLayout, {
  name: 'CurrentUserForLayout'
})(Profile);
```


<h3 id="graphql-props">Using `props`</h3>

If you want a greater level of control, use `props` to map the query results to the props to be passed to the child component:

```js

import React, { Component, PropTypes } from 'react';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

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
  props({ ownProps, data: { loading, currentUser, refetch } }) => ({
    userLoading: loading,
    user: currentUser,
    refetchUser: refetch,
  }),
})(Profile);
```

This style of usage leads to the greatest decoupling between your presentational component (`Profile`) and Apollo.
