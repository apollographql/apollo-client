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

This example shows how you'd create a middleware.  It can be done either by providing the required object directly to `.use()` or by creating an object and passing it to `.use()`. In both cases all middleware objects have to be wrapped inside an array.

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

The above example shows the use of a single middleware passed directly to .use(). It checks to see if we have a token (JWT, for example) and passes that token into the HTTP header of the request, so we can authenticate interactions with GraphQL performed through our network interface.

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
'Afterware' is very similar to a middleware, except that a afterware runs after a request has been made,
that is when a response is going to get processed. It's perfect for responding to the situation where a user becomes logged out during their session.

It is possible to use afterware with the network interface created via `createNetworkInterface`.
In order to do so, you must pass an array of objects into the interface created with `createNetworkInterface()`.
Each object must contain an `applyAfterware` method with the following parameters:

- `{ response }: object` A object contain the HTTP response of a GraphQL fetch.
- `next: function` This function pushes the HTTP response onward through the afterware.

This example shows how you'd create a afterware.
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

<h2 id="custom-network-interface">Custom network interface</h2>

You can define a custom network interface and pass it to the Apollo Client to send your queries in a different way. You might want to do this for a variety of reasons:

1. You want a custom transport that sends queries over Websockets instead of HTTP
2. You want to modify the query or variables before they are sent
3. You want to run your app against a mocked client-side schema and never send any network requests at all

All you need to do is create a `NetworkInterface` and pass it to the `ApolloClient` constructor.

<h3 id="NetworkInterface"><i>interface</i> NetworkInterface</h3>

This is the interface that an object should implement so that it can be used by the Apollo Client to make queries.

- `query(request: GraphQLRequest): Promise<GraphQLResult>` This function on your network interface is pretty self-explanatory - it takes a GraphQL request object, and should return a promise for a GraphQL result. The promise should be rejected in the case of a network error.

<h3 id="GraphQLRequest"><i>interface</i> GraphQLRequest</h3>

Represents a request passed to the network interface. Has the following properties:

- `query: string` The query to send to the server.
- `variables: Object` The variables to send with the query.
- `debugName: string` An optional parameter that will be included in error messages about this query.

<h3 id="GraphQLResult"><i>interface</i> GraphQLResult</h3>

This represents a result that comes back from the GraphQL server.

- `data: any` This is the actual data returned by the server.
- `errors: Array` This is an array of errors returned by the server.

<h2 id="query-batching">Query batching</h2>

Apollo lets you automatically batch multiple queries into one request when they are made within a certain interval. This means that if you render several components, for example a navbar, sidebar, and content, and each of those do their own GraphQL query, they will all be sent in one roundtrip. This batching supports all GraphQL endpoints, including those that do not implement transport-level batching, by merging together queries into one top-level query with multiple fields.

To use batching, simply pass a `BatchedNetworkInterface` to the `ApolloClient` constructor. You can do so by using  `createBatchingNetworkInterface` instead of `createNetworkInterface`. `createBatchingNetworkInterface` takes a single options object (the same as `createNetworkInterface`) with an additional `batchInterval` option, which determines how long the network interface batches up queries before sending them to the server.

<h3 id="BatchingExample">Batching example</h3>

This example shows how to create the `BatchedNetworkInterface` that you'll pass to the `ApolloClient` constructor:

```javascript
import ApolloClient, { createBatchingNetworkInterface } from 'apollo-client';

const batchingNetworkInterface = createBatchingNetworkInterface({
  uri: 'localhost:3000',
  batchInterval: 10,
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
Query batching is a transport-level mechanism that works only with servers that support it (for example Apollo's [graphql-server](https://github.com/apollostack/graphql-server). Requests to servers that don't support transport batching will fail. If transport batching is turned on, multiple requests are batched together in an array:

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
