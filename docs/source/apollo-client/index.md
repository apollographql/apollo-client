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

The most convenient way to use Apollo Client in your app is through [react-apollo](react.html) or [angular2-apollo](angular2.html), so once you've initialized the client following the directions below head over there to see how to connect the data to your UI.

## Initializing

The Apollo Client class is the thing you import from this package, and should be instantiated to communicate with your server. You can instantiate as many clients as you want, but most apps will have exactly one of these. If you want to talk to multiple backends, the right place to do that is in your GraphQL server.

<h3 id="ApolloClient" title="ApolloClient constructor">new ApolloClient(options)</h3>

Instantiate a new Apollo Client.

- `networkInterface` (Optional, defaults to an HTTP interface that points to `/graphql`) The network interface to use when sending GraphQL queries to the server. Create this using [createNetworkInterface](#createNetworkInterface), or make a [totally custom one](network.html).
- `dataIdFromObject` (Optional) A function to use during result normalization to determine the IDs of result objects. Function signature should be `(result: Object) => string`. [Learn more about normalization.](how-it-works.html#normalize)
- `reduxRootKey` (Optional, `'apollo'` by default) The key under which Apollo data will be stored in the Redux store. [Read more about integrating with Redux](redux.html). If you aren't integrating with an existing Redux store, don't worry about this.

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

<h4 id="networkInterfaceMiddleware" title="Middleware">Middleware</h4>

It is possible to use middleware with the network interface created via `createNetworkInterface`.  In order to do so, you must pass an object into the interface created with `createNetworkInterface()`.  This object must contain an `applyMiddleware` method with the following parameters:

- `req: object` The HTTP request being processed by the middleware.
- `next: function` This function pushes the HTTP request onward through the middleware.

This example shows how you'd create a middleware.  It can be done either by providing the requried object directly to `.use()` or by creating a function/object and passing it (or an array) to `.use()`.

In both examples, we'll show how you would add an authentication token to the HTTP header of the requests being sent by the client.

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface('/graphql');

networkInterface.use({
  applyMiddleWare(req, next) => {
    if (!req.options.header) {
      req.options.header = {};  // Create the header object if needed.
    }
    req.options.header.authorization = localStorage.getItem('token') ? localStorage.getItem('token') : null;
    next();
  }
});

const client = new ApolloClient({
  networkInterface,
});
```

The above example shows use of a single middleware passed directly to .use().  It checks to see if we have a token (JWT, for example) and pass that token in the HTTP header of the request, so we can authenticate interactions with GraphQL performed through our network interface.

The following example shows use of multiple middlewares passed as an array:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface('/graphql');
const token = 'first-token-value';
const token2 = 'second-token-value';

function exampleWare1 () {
  applyMiddleware(req, next) => {
    if (!req.options.header) {
      req.options.header = {};  // Create the header object if needed.
    }
    req.options.header.authorization = token;
    next();
  }
}

function exampleWare2 () {
  applyMiddleware(req, next) => {
    if (!req.options.header) {
      req.options.header = {};  // Create the header object if needed.
    }
    req.options.header.authorization = token2;
    next();
  }
}

const exWare1 = new exampleWare1();
const exWare2 = new exampleWare2();

networkInterface.use([exWare1, exWare2]);

const client = new ApolloClient({
  networkInterface,
});
```

Given the above code, the header's `Authorization` value will be that of `token2`.  This example shows how you can use more than one middleware to make multiple/separate modifications to the request being processed in the form of a chain.  This example doesn't show the use of `localStorage`, but is instead just meant to demonstrate the use of more than one middleware, passed to `.use()` as an array.

<h4 id="corsSupport" title="cors support">CORS support</h4>

If your GraphQL server and client application are running on different origins, you will get HTTP 405 errors thrown by the client. This happens when recieving the response from the server which is denying the request because of CORS. The client is working as designed. CORS support should be enabled in the apollo-server instance. How to do this is documented in the [apollo-server section](/apollo-server/tools.html#corsSupport).

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
