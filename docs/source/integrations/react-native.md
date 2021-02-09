---
title: Integrating with React Native
---

You can use Apollo Client with React Native exactly as you do with React.js. Install it with `npm` like so:

```bash
npm install @apollo/client graphql
```

Then wrap your application in the `ApolloProvider` component, like so:

```jsx
import React from 'react';
import { AppRegistry } from 'react-native';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

// Initialize Apollo Client
const client = new ApolloClient({
  uri: 'localhost:4000/graphql',
  cache: new InMemoryCache()
});

const App = () => (
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>
);

AppRegistry.registerComponent('MyApplication', () => App);
```

For more information on setting up Apollo Client, see [Getting started](../get-started/).

## Example application

[This sample application](https://github.com/GraphQLGuide/guide-react-native) maintained by [The GraphQL Guide](https://graphql.guide/) uses Apollo Client with React Native.

## Apollo Devtools

[React Native Debugger](https://github.com/jhen0409/react-native-debugger) supports the [Apollo Client Devtools](../development-testing/developer-tooling/#apollo-client-devtools):

1. Install React Native Debugger and open it.
2. Enable "Debug JS Remotely" in your app.
3. If you don't see the Developer Tools panel or the Apollo tab is missing from it, toggle the Developer Tools by right-clicking anywhere and selecting **Toggle Developer Tools**.
