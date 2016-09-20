---
title: Integrating with React Native
---

You can use Apollo with React Native exactly as you would with React Web.

To introduce Apollo to your app, install `react-apollo` and `apollo-client` from npm and use them in your app as outlined in the [setup](initialization.html) article:

```bash
npm install apollo-client react-apollo graphql-tag --save
```

```js
import React from 'react';
import { AppRegistry } from 'react-native';
import ApolloClient from 'apollo-client';
import { ApolloProvider } from 'react-apollo';

// Create the client as outlined above
const client = new ApolloClient();

const App = () => (
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>
);

AppRegistry.registerComponent('MyApplication', () => App);
```

If you are new to using Apollo with React, you should probably read this guide from [the beginning](index.html).

<h2 id="examples">Examples</h2>

There are some Apollo examples written in React Native that you may wish to refer to:

1. The ["Hello World" example](https://github.com/apollostack/frontpage-react-native-app) used at dev.apolldata.com.
2. A [GitHub API Example](https://github.com/apollostack/GitHub-GraphQL-API-Example) built to work with GitHub's new GraphQL API.

> If you've got an example to post here, please hit the "Edit on GitHub" button above and let us know!
