---
title: Integrating with React Native
---

You can use Apollo with React Native exactly as you would with React Web.

To introduce Apollo to your app, install `react-apollo` from npm and use them in your app as outlined in the [setup](/essentials/get-started/) article:

```bash
npm install react-apollo --save
```

```jsx
import React from 'react';
import { AppRegistry } from 'react-native';
import { ApolloClient } from 'apollo-client';
import { ApolloProvider } from 'react-apollo';

// Create the client as outlined in the setup guide
const client = new ApolloClient();

const App = () => (
  <ApolloProvider client={client}>
    <MyRootComponent />
  </ApolloProvider>
);

AppRegistry.registerComponent('MyApplication', () => App);
```

If you are new to using Apollo with React, you should probably read the [React guide](/).

## Examples

There are some Apollo examples written in React Native that you may wish to refer to:

1. The ["Hello World" example](https://github.com/apollographql/frontpage-react-native-app) used at dev.apollodata.com.
2. A [GitHub API Example](https://github.com/apollographql/GitHub-GraphQL-API-Example) built to work with GitHub's new GraphQL API.

## Apollo Dev Tools

[React Native Debugger](https://github.com/jhen0409/react-native-debugger) supports the [Apollo Client Devtools](https://github.com/apollographql/apollo-client-devtools):

1. Install React Native Debugger and open it.
2. Enable "Debug JS Remotely" in your app.
3. (Optional) If you do not see the Developer Tools panel or the Apollo tab is missing in them, toggle the Developer Tools by right clicking anywhere and selecting "Toggle Developer Tools".
