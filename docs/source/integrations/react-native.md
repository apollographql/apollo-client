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
  uri: 'http://localhost:4000/graphql',
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

#### 1. Using [React Native Debugger](https://github.com/jhen0409/react-native-debugger)

The React Native Debugger supports the [Apollo Client Devtools](../development-testing/developer-tooling/#apollo-client-devtools):

  1. Install React Native Debugger and open it.
  2. Enable "Debug JS Remotely" in your app.
  3. If you don't see the Developer Tools panel or the Apollo tab is missing from it, toggle the Developer Tools by right-clicking anywhere and selecting **Toggle Developer Tools**.

#### 2. Using [Flipper](https://fbflipper.com/)

A community plugin called [React Native Apollo devtools](https://github.com/razorpay/react-native-apollo-devtools) is available for Flipper, which supports viewing cache data.

   1. Install Flipper and open it.
   2. Go to add plugin and search for `react-native-apollo-devtools` and install it
   3. Add `react-native-flipper` and `react-native-apollo-devtools-client` as dev dependecy to react native app.
   4. Initialize the plugin with flipper on client side

      ```ts
        import { apolloDevToolsInit } from 'react-native-apollo-devtools-client';

        const client = new ApolloClient({
          // ...
        });

        if (__DEV__) {
          apolloDevToolsInit(client);
        }
      ```

## Consuming multipart HTTP via text streaming

By default, React Native ships with a `fetch` implementation built on top of XHR that does not support text streaming.

For this reason, if you are using *either* [`@defer`](../data/defer) or [subscriptions over multipart HTTP](../data/subscriptions#subscriptions-via-multipart-http)—features that use text streaming to read multipart HTTP responses—there are additional steps you'll need to take to polyfill this functionality.

1. Install `react-native-fetch-api` and `react-native-polyfill-globals` and save them both as dependencies.
2. In your application's entrypoint (i.e. `index.js`, `App.js` or similar), import the following three polyfills and call each of the `polyfill*` functions before any application code:
  ```tsx
  import { polyfill as polyfillEncoding } from "react-native-polyfill-globals/src/encoding";
  import { polyfill as polyfillReadableStream } from "react-native-polyfill-globals/src/readable-stream";
  import { polyfill as polyfillFetch } from "react-native-polyfill-globals/src/fetch";

  polyfillReadableStream();
  polyfillEncoding();
  polyfillFetch();
  ```
3. Finally, there’s a special option we’ll need to pass to our polyfilled `fetch`. Create an `HttpLink` so we can set the following on our default `fetchOptions`:
```tsx
const link = new HttpLink({
  uri: "http://localhost:4000/graphql",
  fetchOptions: {
    reactNative: { textStreaming: true },
  },
});
```

> **Note**: if you're still experiencing issues on Android after adding the polyfills above, there may be a library like Flipper that is intercepting requests during local development. Try commenting out `NetworkFlipperPlugin` in e.g. `android/app/src/debug/java/com/<projectname>/ReactNativeFlipper.java`, or running your app in release mode.

Now you're ready to use `@defer` and/or multipart subscriptions over HTTP in your React Native app!

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
