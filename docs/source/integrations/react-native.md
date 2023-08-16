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

## Apollo Client Devtools

[React Native Debugger](https://github.com/jhen0409/react-native-debugger) supports the [Apollo Client Devtools](../development-testing/developer-tooling/#apollo-client-devtools):

1. Install React Native Debugger and open it.
2. Enable "Debug JS Remotely" in your app.
3. If you don't see the Developer Tools panel or the Apollo tab is missing from it, toggle the Developer Tools by right-clicking anywhere and selecting **Toggle Developer Tools**.

## Troubleshooting

* `Uncaught Error: Cannot read property 'prototype' of undefined`, or similar Metro build error when importing from `@apollo/client`

This is due to the way [the Metro bundler supports `.cjs` and `.mjs` files](https://github.com/facebook/metro/issues/535#issuecomment-1198071838): it requires additional configuration to _implicitly_ resolve files with these extensions, so `import { ApolloClient, InMemoryCache } from '@apollo/client'` will result in an error. You can amend your import statement to e.g. `import { ApolloClient, InMemoryCache } from '@apollo/client/main.cjs'`, or you can install `@expo/metro-config` and configure their implicit resolution via `metro.config.js` in the root of your project:

```js title="metro.config.js"
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push(
  'cjs'
);

module.exports = config;
```
