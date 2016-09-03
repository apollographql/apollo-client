---
title: Apollo Client
order: 100
description: Basic information on getting started with and using the Apollo Client.
---

The Apollo Client can easily be dropped into any JavaScript frontend where you want to use data from a GraphQL server.

[Follow apollostack/apollo-client on GitHub.](https://github.com/apollostack/apollo-client)

## Installing

```txt
npm install apollo-client graphql-tag
```

To use this client in a web browser or mobile app, you'll need a build system capable of loading NPM packages on the client. Some common choices include Browserify, Webpack, and Meteor 1.3. Move on to the next article to see how to import and initialize the client.

The most convenient way to use Apollo Client in your app is through [react-apollo](react.html) or [angular2-apollo](angular2.html), so once you've initialized the client following the directions below head over there to see how to connect the data to your UI.

## Initializing

The Apollo Client class is the thing you import from this package, and should be instantiated to communicate with your server. You can instantiate as many clients as you want, but most apps will have exactly one of these. If you want to talk to multiple backends, the right place to do that is in your GraphQL server.

<h3 id="ApolloClient" title="new ApolloClient()">new ApolloClient(options)</h3>

Instantiate a new Apollo Client.

- `networkInterface` (Optional, defaults to an HTTP interface that points to `/graphql`) The network interface to use when sending GraphQL queries to the server. Create this using [createNetworkInterface](#createNetworkInterface), or make a [totally custom one](network.html).
- `dataIdFromObject` (Optional) A function to use during result normalization to determine the IDs of result objects. Function signature should be `(result: Object) => string`. [Learn more about normalization.](how-it-works.html#normalize)
- `reduxRootKey` (Optional, `'apollo'` by default) The key under which Apollo data will be stored in the Redux store. [Read more about integrating with Redux](redux.html). If you aren't integrating with an existing Redux store, don't worry about this.
- `shouldBatch` (Optional, `false` by default) A boolean value that specifies whether Apollo Client should batch queries together into one request. If you pass this option, the network interface must support batching. [Read more about query batching](network.html).
- `queryTransformer` (Optional) A function that transforms GraphQL `SelectionSet`s before they are sent to the server. One common option which adds `__typename` to all queries can be imported with `import { addTypename } from 'apollo-client'`.

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

<h2 id="gql">gql query strings</h2>

When using Apollo Client, you usually write your queries using multiline template literals. These literals need to be tagged with the `gql` tag, like this:

```js
import gql from 'graphql-tag';

const query = gql`
  {
    user(id: 5) {
      username
    }
  }
`
```

The `gql` tag is a function that parses the query string passed to it. It can be found in the `graphql-tag` companion package on npm.

As a shortcut, if you prefer *not* to import `gql` tag in every place you use it, you can register it as a global:

```js
// In the browser
import gql from 'graphql-tag';
window['gql'] = gql;

// In node.js
import gql from 'graphql-tag';
global['gql'] = gql;

// Now, in any part of your app you can use the gql tag
const query = gql`...`;
```

**Note:** ES6 imports are hoisted, which may mean that client code using the `gql` tag gets evaluated before the registration of the global. To avoid race conditions, it's best to just import the tag into each file that uses it.

<h3 id="why-gql">Why use a template literal?</h3>

This template literal tag serves two functions:

1. It parses the query string.
2. It tells developer tools like `eslint-plugin-graphql` which strings in your app are GraphQL queries, so that they can be treated specially.

Being able to statically analyze GraphQL queries in your app is a huge benefit of GraphQL, so it's correct to write them as special strings that can be found by these tools.

<h2 id="network-interfaces">Network interfaces</h2>

Apollo Client has a pluggable network interface layer, which can let you configure how queries are sent over HTTP, or replace the whole network part with something completely custom, like a websocket transport, mocked server data, or anything else you can imagine.

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

<h3 id="networkInterfaceMiddleware" title="Middleware">Middleware</h3>

It is possible to use middleware with the network interface created via `createNetworkInterface`.  In order to do so, you must pass an array of objects into the interface created with `createNetworkInterface()`.  Each object must contain an `applyMiddleware` method with the following parameters:

- `req: object` The HTTP request being processed by the middleware.
- `next: function` This function pushes the HTTP request onward through the middleware.

This example shows how you'd create a middleware.  It can be done either by providing the required object directly to `.use()` or by creating an object and passing it to `.use()`. In both cases all middleware objects have to be wrapped inside an array.

In both examples, we'll show how you would add an authentication token to the HTTP header of the requests being sent by the client.

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface('/graphql');

networkInterface.use([{
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the header object if needed.
    }
    req.options.headers.authorization = localStorage.getItem('token') ? localStorage.getItem('token') : null;
    next();
  }
}]);

const client = new ApolloClient({
  networkInterface,
});
```

The above example shows the use of a single middleware passed directly to .use(). It checks to see if we have a token (JWT, for example) and passes that token into the HTTP header of the request, so we can authenticate interactions with GraphQL performed through our network interface.

The following example shows the use of multiple middlewares passed as an array:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface('/graphql');
const token = 'first-token-value';
const token2 = 'second-token-value';

const exampleWare1 = {
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the headers object if needed.
    }
    req.options.headers.authorization = token;
    next();
  }
}

const exampleWare2 = {
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the headers object if needed.
    }
    req.options.headers.authorization = token2;
    next();
  }
}

networkInterface.use([exampleWare1, exampleWare2]);

const client = new ApolloClient({
  networkInterface,
});
```

Given the above code, the header's `Authorization` value will be that of `token2`.  This example shows how you can use more than one middleware to make multiple/separate modifications to the request being processed in the form of a chain.  This example doesn't show the use of `localStorage`, but is instead just meant to demonstrate the use of more than one middleware, passed to `.use()` as an array.

<h3 id="networkInterfaceAfterware" title="Afterware">Afterware</h3>
A afterware is very similar to a middleware, except that a afterware runs after a request has been made,
that is when a response is going to get processed.

It is possible to use afterware with the network interface created via `createNetworkInterface`.
In order to do so, you must pass an array of objects into the interface created with `createNetworkInterface()`.
Each object must contain an `applyAfterware` method with the following parameters:

- `{ response }: object` A object contain the HTTP response of a graphQL fetch.
- `next: function` This function pushes the HTTP response onward through the afterware.

This example shows how you'd create a afterware.
It can be done either by providing the required object directly to `.useAfter()`
or by creating an object and passing it to `.useAfter()`.
In both cases all afterware objects have to be wrapped inside an array.

Below are some examples of using afterwares.

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import {logout} from './logout';

const networkInterface = createNetworkInterface('/graphql');

networkInterface.useAfter([{
  applyAfterware({response}, next) {
    if (response.status === 401) {
      logout();
    }
    next();
  }
}]);

const client = new ApolloClient({
  networkInterface,
});
```

The above example shows the use of a single afterware passed directly to `.useAfter()`.
It checks to see if the response status code is equal to 401 and if it is then we will
logout the user from the application.

The following example shows the use of multiple afterwares passed as an array:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import {redirectTo} from './redirect';

const networkInterface = createNetworkInterface('/graphql');

const exampleWare1 = {
  applyAfterware({response}, next) {
    if (response.status === 500) {
      console.error('Server returned an error');
    }
    next();
  }
}

const exampleWare2 = {
  applyAfterware({response}, next) {
    if (response.status === 200) {
      redirectTo('/');
    }
    next();
  }
}

networkInterface.useAfter([exampleWare1, exampleWare2]);

const client = new ApolloClient({
  networkInterface,
});
```

This example shows how you can use more than one afterware to make multiple/separate
modifications to the response being processed in the form of a chain.

<h3 id="corsSupport">CORS support</h3>

If your GraphQL server and client application are running on different origins, you will get HTTP 405 errors thrown by the client. This happens when receiving the response from the server which is denying the request because of CORS. The client is working as designed. CORS support should be enabled in the apollo-server instance. How to do this is documented in the [apollo-server section](/apollo-server/tools.html#corsSupport).

<h3 id="fetch-polyfill">Fetch polyfill</h3>

Apollo uses [fetch](https://fetch.spec.whatwg.org/) behind the scenes to make HTTP requests. Be aware that many browser versions now support the `window.fetch` function natively (check [caniuse.com](http://caniuse.com/#feat=fetch)), but Node, for example, doesn't (as of v6).

Where it is not supported, you can use one of several popular polyfills, including [whatwg-fetch](https://github.com/github/fetch), [node-fetch](https://github.com/bitinn/node-fetch) or [isomorphic-fetch](https://github.com/matthew-andrews/isomorphic-fetch).

<h2 id="store-rehydration">Store hydration</h2>

For applications that support server side rendering, or that can perform some queries on the server prior to rendering the client, ApolloClient allows for setting the initial state of data. This is sometimes called store rehydration for redux applications.

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

## Change log

Upgrading to a new version? [Check out the change log on GitHub](https://github.com/apollostack/apollo-client/blob/master/CHANGELOG.md).
