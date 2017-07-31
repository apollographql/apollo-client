---
title: Network layer
order: 110
description: How to configure Apollo Client's network layer, or build your own.
---

<h2 id="network-interfaces">Network interfaces</h2>

Apollo Client has a pluggable network interface layer, which can let you configure how queries are sent over HTTP, or replace the whole network part with something completely custom, like a websocket transport, mocked server data, or anything else you can imagine.

<h3 id="createNetworkInterface" title="createNetworkInterface">Creating a network interface</h3>

To create a network interface, use [`createNetworkInterface`](apollo-client-api.html#createNetworkInterface).

Here's how you would instantiate a new client with a custom endpoint URL:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface({ uri: 'https://example.com/graphql' });

const client = new ApolloClient({
  networkInterface,
});
```

And if you needed to pass additional options to [`fetch`](https://github.github.io/fetch/):

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface({
  uri: 'https://example.com/graphql',
  opts: {
    // Additional fetch options like `credentials` or `headers`
    credentials: 'same-origin',
  }
});

const client = new ApolloClient({
  networkInterface,
});
```

<h3 id="networkInterfaceMiddleware" title="Middleware">Middleware</h3>

It is possible to use middleware with the network interface created via `createNetworkInterface`. Middleware is used to inspect and modify every request made over the `netWorkInterface`, for example, adding authentication tokens to every query. In order to add middleware, you must pass an array of objects into the interface created with `createNetworkInterface()`.  Each object must contain an `applyMiddleware` method with the following parameters:

- `req: object` The HTTP request being processed by the middleware.
- `next: function` This function pushes the HTTP request onward through the middleware.

The `req` object contains the options from the `createNetworkInterface` definition, but you can pass extra options to the request by using the `req.options` object.

The following example shows how you'd create a middleware.  It can be done either by providing the required object directly to `.use()` or by creating an object and passing it to `.use()`. In both cases all middleware objects have to be wrapped inside an array.

In both examples, we'll show how you would add an authentication token to the HTTP header of the requests being sent by the client.

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface({ uri: '/graphql' });

networkInterface.use([{
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the header object if needed.
    }
    req.options.headers['authorization'] = localStorage.getItem('token') ? localStorage.getItem('token') : null;
    next();
  }
}]);

const client = new ApolloClient({
  networkInterface,
});
```

The above example shows the use of a single middleware passed directly to `.use()`. It checks to see if we have a token (JWT, for example) and passes that token into the HTTP header of the request, so we can authenticate interactions with GraphQL performed through our network interface.

The following example shows the use of multiple middlewares passed as an array:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface({ uri: '/graphql' });
const token = 'first-token-value';
const token2 = 'second-token-value';

const exampleWare1 = {
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the headers object if needed.
    }
    req.options.headers['authorization'] = token;
    next();
  }
}

const exampleWare2 = {
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the headers object if needed.
    }
    req.options.headers['authorization'] = token2;
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

'Afterware' is very similar to a middleware, except that an afterware runs after a request has been made,
that is when a response is going to get processed. It's perfect for responding to the situation where a user becomes logged out during their session.

It is possible to use afterware with the network interface created via `createNetworkInterface`.
In order to do so, you must pass an array of objects into the interface created with `createNetworkInterface()`.
Each object must contain an `applyAfterware` method with the following parameters:

- `{ response }: object` An object containing the HTTP response of a GraphQL fetch.
- `next: function` This function pushes the HTTP response onward through the afterware.

The following example demonstrates how to implement an afterware function.
It can be done either by providing the required object directly to `.useAfter()`
or by creating an object and passing it to `.useAfter()`.
In both cases all afterware objects have to be wrapped inside an array.

Below are some examples of using afterwares.

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import {logout} from './logout';

const networkInterface = createNetworkInterface({ uri: '/graphql' });

networkInterface.useAfter([{
  applyAfterware({ response }, next) {
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

const networkInterface = createNetworkInterface({ uri: '/graphql' });

const exampleWare1 = {
  applyAfterware({ response }, next) {
    if (response.status === 500) {
      console.error('Server returned an error');
    }
    next();
  }
}

const exampleWare2 = {
  applyAfterware({ response }, next) {
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

<h3 id="networkInterfaceChaining" title="Chaining">Chaining</h3>

It is possible to build a chain made of `.use()` and `.useAfter()` calls in any order :

```js
networkInterface.use([exampleWare1])
  .use([exampleWare2])
  .useAfter([exampleWare3])
  .useAfter([exampleWare4])
  .use([exampleWare5]);
```

<h2 id="websocket">GraphQL over WebSocket</h2>

Another alternative for network interface is GraphQL over WebSocket, using [`subscriptions-transport-ws`](https://github.com/apollographql/subscriptions-transport-ws/).

You can the create WebSocket as full-transport, and pass all GraphQL operations over the WebSocket (`Query`, `Mutation` and `Subscription`), or use a hybrid network interface and execute `Query` and `Mutation` over HTTP, and only `Subscription` over the WebSocket.

<h3 id="full-websocket">Full WebSocket</h3>

To start with full WebSocket, use `subscriptions-transport-ws` and create your [GraphQL subscriptions server](/tools/#GraphQL-subscriptions).

Then, configure you client side by creating an instance of `SubscriptionClient`, and use the created instance and your network interface:

```js
import { SubscriptionClient } from 'subscriptions-transport-ws';
import ApolloClient from 'apollo-client';

const GRAPHQL_ENDPOINT = 'ws://localhost:3000/graphql';

const client = new SubscriptionClient(GRAPHQL_ENDPOINT, {
  reconnect: true,
});

const apolloClient = new ApolloClient({
    networkInterface: client,
});
```

<h3 id="hybrid-websocket">Hybrid WebSocket</h3>

To use WebSocket for subscriptions only, create your regular network interface for queries and mutation, and create an instanace of `SubscriptionClient`

Then, use `addGraphQLSubscriptions` to combine the two into a single hybrid network interface:

```js
import {SubscriptionClient, addGraphQLSubscriptions} from 'subscriptions-transport-ws';
import ApolloClient, {createNetworkInterface} from 'apollo-client';

// Create regular NetworkInterface by using apollo-client's API:
const networkInterface = createNetworkInterface({
 uri: 'http://localhost:3000' // Your GraphQL endpoint
});

// Create WebSocket client
const wsClient = new SubscriptionClient(`ws://localhost:5000/`, {
    reconnect: true,
    connectionParams: {
        // Pass any arguments you want for initialization
    }
});

// Extend the network interface with the WebSocket
const networkInterfaceWithSubscriptions = addGraphQLSubscriptions(
    networkInterface,
    wsClient
);

// Finally, create your ApolloClient instance with the modified network interface
const apolloClient = new ApolloClient({
    networkInterface: networkInterfaceWithSubscriptions
});
```

<h2 id="custom-network-interface">Custom network interface</h2>

You can define a custom network interface and pass it to the Apollo Client to send your queries in a different way. You might want to do this for a variety of reasons:

1. You want a custom transport that sends queries over Websockets instead of HTTP
2. You want to modify the query or variables before they are sent
3. You want to run your app against a mocked client-side schema and never send any network requests at all

All you need to do is create a `NetworkInterface` and pass it to the `ApolloClient` constructor.

<h3 id="NetworkInterface"><i>interface</i> NetworkInterface</h3>

This is the interface that an object should implement so that it can be used by the Apollo Client to make queries.

- `query(request: Request): Promise<ExecutionResult>` This function on your network interface is pretty self-explanatory - it takes a GraphQL request object, and should return a promise for a GraphQL result. The promise should be rejected in the case of a network error.

<h3 id="Request"><i>interface</i> Request</h3>

Represents a request passed to the network interface. Has the following properties:

- `query: Object` AST of the query to send to the server. You can get stringify this value by using `print` function from `graphql/language/printer` package.
- `variables: Object` The variables to send with the query.
- `operationName: string` An optional parameter that will be included in error messages about this query.

<h3 id="ExecutionResult"><i>interface</i> ExecutionResult</h3>

This represents a result that comes back from the GraphQL server.

- `data: any` This is the actual data returned by the server.
- `errors: Array` This is an array of errors returned by the server.

<h3 id="CustomNetworkInterfaceExample">Example</h3>

To illustrate how you would define your own custom network interface, this is a code example of a <i>HybridNetworkInterface</i>. What this custom network interface does is batch requests by default, but allows a programmer to opt certain queries out of the batch queue and make direct requests instead. This might be valuable for particularly urgent requests that shouldn't be batched with slower queries and delayed by the batch interval poll time.

```js
/* @flow */
import {
  createBatchingNetworkInterface,
  createNetworkInterface,
  HTTPBatchedNetworkInterface,
  HTTPFetchNetworkInterface,
  Request,
} from 'apollo-client';

import { ExecutionResult } from 'graphql';

export class HTTPHybridNetworkInterface {
  batchedInterface: HTTPBatchedNetworkInterface;
  networkInterface: HTTPFetchNetworkInterface;

  constructor(opts: Object) {
    this.batchedInterface = createBatchingNetworkInterface(opts);
    this.networkInterface = createNetworkInterface(opts);
  }

  query(request: Request): Promise<ExecutionResult> {
    if (request.variables && request.variables.__disableBatch) {
      return this.networkInterface.query(request);
    }

    return this.batchedInterface.query(request);
  }

  use(middlewares: Array<*>) {
    this.networkInterface.use(middlewares);
    this.batchedInterface.use(middlewares);
    return this;
  }

  useAfter(afterwares: Array<*>) {
    this.networkInterface.useAfter(afterwares);
    this.batchedInterface.useAfter(afterwares);
    return this;
  }
}

export function createHybridNetworkInterface(opts: Object) {
  return new HTTPHybridNetworkInterface(opts);
}
```

You can pass arbitrary data into your network interface using variables. In this example, any request can be made to skip the batch by setting the variable `__disableBatch` on the request.

<h2 id="query-batching">Query batching</h2>


Apollo lets you automatically batch multiple queries into one request when they are made within a certain interval. This means that if you render several components, for example a navbar, sidebar, and content, and each of those do their own GraphQL query, they will all be sent in one roundtrip. Batching works only with server that support batched queries (for example [graphql-server](https://github.com/apollostack/graphql-server)). Batched requests to servers that don't support batching will fail.

To use batching, simply pass a `BatchedNetworkInterface` to the `ApolloClient` constructor. You can do so by using  `createBatchingNetworkInterface` instead of `createNetworkInterface`. `createBatchingNetworkInterface` takes a single options object (the same as `createNetworkInterface`) with an additional `batchInterval` option, which determines how long (in milliseconds) the network interface batches up queries before sending them to the server. You can also provide the `batchMax` option to define the maximum amount of queries you want in one batch. When left empty this will send all queries within the `batchInterval` in one batch.

<h3 id="BatchingExample">Query batching example</h3>

This example shows how to create the `BatchedNetworkInterface` that you'll pass to the `ApolloClient` constructor:

```javascript
import ApolloClient, { createBatchingNetworkInterface } from 'apollo-client';

const batchingNetworkInterface = createBatchingNetworkInterface({
  uri: 'localhost:3000',
  batchInterval: 10,  // in milliseconds
  batchMax: 10,
  opts: {
    // Options to pass along to `fetch`
  }
});

const apolloClient = new ApolloClient({
  networkInterface: batchingNetworkInterface,
});

// These two queries happen in quick succession, possibly in totally different
// places within your UI.
apolloClient.query({ query: firstQuery });
apolloClient.query({ query: secondQuery });

// You don't have to do anything special - Apollo will send the two queries as one request.
```

<h3 id="BatchingExplained">How query batching works</h3>
Query batching is a transport-level mechanism that works only with servers that support it (for example, Apollo's [graphql-server](https://github.com/apollostack/graphql-server)). Requests to servers that don't support transport batching will fail. If transport batching is turned on, multiple requests are batched together in an array:

```
[{
   query: `query Query1 { someField }`,
   variables: {},
   operationName: 'Query1',
 },
 {
   query: `query Query2 ($num: Int){ plusOne(num: $num) }`,
   variables: { num: 3 },
   operationName: 'Query2',
 }]
 ```

 <h2 id="query-deduplication">Query deduplication</h2>
 Query deduplication can help reduce the number of queries that are sent over the wire. It is turned off by default, but can be turned on by passing the `queryDeduplication` option to Apollo Client. If turned on, query deduplication happens before the query hits the network layer.

```js
const apolloClient = new ApolloClient({
  networkInterface: batchingNetworkInterface,
  queryDeduplication: true,
});
 ```

 Query deduplication can be useful if many components display the same data, but you don't want to fetch that data from the server many times. It works by comparing a query to all queries currently in flight. If an identical query is currently in flight, the new query will be mapped to the same promise and resolved when the currently in-flight query returns.

 <h2 id="query-batch-wares">Middleware and Afterware for batching network interfaces</h2>

In a batching network interface middlewares and afterwares do not run once per query but instead run once per batch request. Creating middleware and afterware for a batching network interface is very similar as standard middleware and afterware except instead of `applyMiddleware` and `applyAfterware`, you want to use `applyBatchMiddleware` and `applyBatchAfterware`.

```js
import ApolloClient, { createBatchingNetworkInterface } from 'apollo-client';

const networkInterface = createBatchingNetworkInterface({
  uri: 'localhost:3000',
  batchInterval: 10,
  opts: {
   // Options to pass along to `fetch`
  }
});

const token = 'first-token-value';

const authMiddleware = {
  applyBatchMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the headers object if needed.
    }
    req.options.headers['authorization'] = token;
    next();
  }
}

const loggingAfterware = {
  applyBatchAfterware(res, next) {
    console.log(res.responses);
    next();
  }
}

networkInterface.use([authMiddleware]);
networkInterface.useAfter([loggingAfterware]);

const client = new ApolloClient({
  networkInterface,
});
```
