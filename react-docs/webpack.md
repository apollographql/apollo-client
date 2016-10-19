---
title: Webpack loader
---

You can load GraphQL queries over `.graphql` files using Webpack. The package `apollo-tag` comes with a loader easy to setup and with many benefits:

1. Do not process GraphQL ASTs on client-side
2. Optimizes bundle size, since `apollo-tag` does not need to be imported
3. Enable queries to be separated from logic

In the example below, we create a new file called `currentUser.graphql`:

```graphql
query CurrentUserForLayout {
  currentUser {
    login
    avatar_url
  }
}
```

You can load this file in 2 possible ways:

<h2 id="using-connect">Default extension config</h2>

You just need to add a rule in your webpack config file:

```js
loaders: [
  {
    test: /\.(graphql|gql)$/,
    exclude: /node_modules/,
    loader: 'graphql-tag/loader'
  }
]
```

As you can see, `.graphql` or `.gql` files will be parsed whenever imported:

```js
import React, { Component } from 'react';
import { graphql } from 'react-apollo';
import currentUserQuery from './currentUser.graphql';

class Profile extends Component { ... }
Profile.propTypes = { ... };

export default graphql(currentUserQuery)(Profile)
```

<h2 id="using-connect">Require hook</h2>

This is less reusable because you need to prefix the loader for every query import:

```js
// ...
import query from 'graphql-tag/loader!./currentUser.graphql';
// ...
```
