---
title: Apollo Client
order: 100
description: Basic information on getting started with and using the Apollo Client.
---

The Apollo Client can easily be dropped into any JavaScript frontend where you want to use data from a GraphQL server.

[Follow apollostack/apollo-client on GitHub.](https://github.com/apollostack/apollo-client)

## Installing

```txt
npm install apollo-client
```

To use this client in a web browser or mobile app, you'll need a build system capable of loading NPM packages on the client. Some common choices include Browserify, Webpack, and Meteor 1.3. Move on to the next article to see how to import and initialize the client.

## Initializing

The Apollo Client class is the thing you import from this package, and should be instantiated to communicate with your server. You can instantiate as many clients as you want, but most apps will have exactly one of these. If you want to talk to multiple backends, the right place to do that is in your GraphQL server.

<h3 id="ApolloClient" title="ApolloClient">new ApolloClient(options)</h3>

Instantiate a new Apollo Client.

- `networkInterface: NetworkInterface` (Optional, defaults to an interface that points to `/graphql`) The network interface to use when sending GraphQL queries to the server.
- `reduxRootKey: string` (Optional, `apollo` by default) The key under which Apollo data will be stored in the Redux store. [Read more about integrating with Redux](redux.html). If you aren't integrating with an existing Redux store, don't worry about this.

Here's how you would instantiate a default client that points to `/graphql`:

```js
// In ES2015 or TypeScript
import ApolloClient from 'apollo-client';

const client = new ApolloClient();
```

If you're not using ES2015, you can also load it with `require`:

```js
// In plain JavaScript
var ApolloClient = require('apollo-client').default;
```

The rest of the code snippets will use ES2015 import syntax.

<h3 id="createNetworkInterface" title="createNetworkInterface">createNetworkInterface(url, options)</h3>

Create a new HTTP network interface that points to a GraphQL server at a specific URI.

- `url: string` The URL of the remote server, for example `https://example.com/graphql`.
- `options: FetchOptions` (Optional) Options that are passed through to `fetch` XXX link to docs

Here's how you would instantiate a new client with a custom endpoint URL:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface('https://example.com/graphql');

const client = new ApolloClient({
  networkInterface,
});
```

<h4 id="corsSupport" title="cors support">CORS support</h4>

When attempting to setup an apollo-server and client application running on different instances, you will find http-405 errors thrown by the client. This happens when recieving the response from the server which is denying the request because of CORS. The client is working as designed. CORS support should be enabled in the apollo-server instance. Howto can be found in the [apollo-server/tools.md](/source/apollo-server/tools.md). This was encountered using the meteor-stater-kit and was confirmed from others running the apollo-server with express in node.

<h3 id="store-rehydration" title="Loading Intial Data from Server">Loading Intial Data from Server</h3>

For applications that support server side rendering, or that can perform some queries on the server prior to rendering the client, ApolloClient allows for setting the intial state of data. This is sometimes called store rehydration for redux applications.

> Note: if you are using redux externally to apollo, and already have store rehydration, this key isn't needed.

On the server during render and after the application has retrieved all of the data it needs, send the initial state context by assigning the serialized value of the state to somewhere which will be accessible to the client.

For example, using React
```jsx
// on the server
import { renderToStaticMarkup } from 'react-dom/server';

// client is an instance of ApolloClient
const initialState = client.store.getState();

const Html = (props) => (
  <html>
  <body>
    <script dangerouslySetInnerHTML={{__html: `window.__APOLLO_CONTEXT__ = ${JSON.stringify(props.initialState)};`}}></script>
  </body>
  </html>
);

const staticMarkup = renderToStaticMarkup(<Html initialState={initialState} />);
// Now return the static markup to the client...
```
After using the above as the initial server-side rendered HTML, on the client you would will then rehydrate the client using the initial state passed from the server
```js
// on client
const client = new ApolloClient({
  initialState: window.__APOLLO_CONTEXT__,
});
```

Then, when a client calls ApolloClient#query or ApolloClient#watchQuery, the data should be returned instantly because it is already in the store! This also makes full page server side rendering without a page rebuild (if using react for instance) possible because the server rendered template won't differ from the client)
