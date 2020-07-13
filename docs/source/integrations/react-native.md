---
title: Integrating with React Native
---

You can use Apollo with React Native exactly as you would with React Web.

To introduce Apollo to your app, install Apollo Client from npm and use it in your app as outlined in the [setup](../get-started/) article:

```bash
npm install @apollo/client --save
```

```jsx
import React from 'react';
import { AppRegistry } from 'react-native';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

// Create the client as outlined in the setup guide
const client = new ApolloClient({
  cache: new InMemoryCache()
});

const App = () => (
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>
);

AppRegistry.registerComponent('MyApplication', () => App);
```

If you are new to using Apollo with React, you should probably read the [React guide](../).

## Examples

There are some Apollo examples written in React Native that you may wish to refer to:

1. The ["Hello World" example](https://github.com/apollographql/frontpage-react-native-app) used at dev.apollodata.com.
2. A [GitHub API Example](https://github.com/apollographql/GitHub-GraphQL-API-Example) built to work with GitHub's new GraphQL API.

## Apollo Dev Tools

[React Native Debugger](https://github.com/jhen0409/react-native-debugger) supports the [Apollo Client Devtools](https://github.com/apollographql/apollo-client-devtools):

1. Install React Native Debugger and open it.
2. Enable "Debug JS Remotely" in your app.
3. (Optional) If you do not see the Developer Tools panel or the Apollo tab is missing in them, toggle the Developer Tools by right clicking anywhere and selecting "Toggle Developer Tools".
