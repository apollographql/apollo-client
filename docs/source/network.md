---
title: Network layer
order: 110
description: How to point your Apollo client to a different GraphQL server, or use a totally different protocol.
---

<h2 id="network-interfaces">Network interfaces</h2>

Apollo Client has a pluggable network interface layer, which can let you configure how queries are sent over HTTP, or replace the whole network part with something completely custom, like a websocket transport, mocked server data, or anything else you can imagine.

<h3 id="createNetworkInterface" title="createNetworkInterface">Creating a network interface</h3>

To create a network interface, use [`createNetworkInterface`](apollo-client-api.html#createNetworkInterface).

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

- `{ response }: object` A object contain the response. (GraphQLResult).
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
  applyAfterware({ response }, next) {
    if (response.errors) {
      errors.forEach(error => {
        console.error('Error from server', error);
      }
    }
    next();
  }
}]);

const client = new ApolloClient({
  networkInterface,
});
```

The above example shows the use of a single afterware passed directly to `.useAfter()`.
It checks to see if the response has errors in it. and if it does, it will print them to the browser console.

The following example shows the use of multiple afterwares passed as an array:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import {redirectTo} from './redirect';

const networkInterface = createNetworkInterface('/graphql');

const exampleWare1 = {
  applyAfterware({ response }, next) {
    if (response.errors) {
      errors.forEach(error => {
        console.error('Error from server', error);
      }
    }
    next();
  }
}

const exampleWare2 = {
  applyAfterware({ response }, next) {
    if (response.me === null) {
      // user is not logged in.
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


<h2 id="custom-network-interface">Custom network interface</h2>

You can define a custom network interface and pass it to the Apollo Client to send your queries in a different way. You might want to do this for a variety of reasons:

1. You want a custom transport that sends queries over Websockets instead of HTTP
2. You want to modify the query or variables before they are sent
3. You want to run your app against a mocked client-side schema and never send any network requests at all

All you need to do is create a `NetworkInterface` and pass it to the `ApolloClient` constructor.

<h3 id="NetworkInterface">interface NetworkInterface</h3>

This is the interface that an object should implement so that it can be used by the Apollo Client to make queries.

- `query(request: GraphQLRequest): Promise<GraphQLResult>` This function on your network interface is pretty self-explanatory - it takes a GraphQL request object, and should return a promise for a GraphQL result. The promise should be rejected in the case of a network error.

<h3 id="GraphQLRequest">interface GraphQLRequest</h3>

Represents a request passed to the network interface. Has the following properties:

- `query: string` The query to send to the server.
- `variables: Object` The variables to send with the query.
- `debugName: string` An optional parameter that will be included in error messages about this query. XXX do we need this?

<h3 id="GraphQLResult">interface GraphQLResult</h3>

This represents a result that comes back from the GraphQL server.

- `data: any` This is the actual data returned by the server.
- `errors: Array` This is an array of errors returned by the server.

<h2 id="query-batching">Query batching</h2>

Apollo Client can automatically batch multiple queries into one request when they are done within a 10 millisecond interval. This means that if you render several components, for example a navbar, sidebar, and content, and each of those do their own GraphQL query, they will all be sent in one roundtrip. This batching supports all GraphQL endpoints, including those that do not implement transport-level batching, by merging together queries into one top-level query with multiple fields.

To turn on query batching, pass the `shouldBatch: true` option to the `ApolloClient` constructor. In addition, you need to use a network interface that supports batching. The default network interface generated by `createNetworkInterface` supports batching out of the box, but you can convert any network interface to a batching one by calling `addQueryMerging` on it, as described [below](#addQueryMerging).

<h3 id="BatchingExample">Batching example</h3>

Batching is supported in the default network interface, so to turn it on normally you just have to pass `shouldBatch: true` to the constructor:

```javascript
import ApolloClient from 'apollo-client';

const apolloClient = new ApolloClient({
  shouldBatch: true,
});

// These two queries happen in quick suggestion, possibly in totally different
// places within your UI.
apolloClient.query({ query: firstQuery });
apolloClient.query({ query: secondQuery });

// You don't have to do anything special - Apollo will send the two queries as one request.
```

If you have developed a custom network interface, you can easily add batching via query merging to it with `addQueryMerging`:

```js
import { myCustomNetworkInterface } from './network';
import { addQueryMerging } from 'apollo-client';

const networkInterface = addQueryMerging(myCustomNetworkInterface);

const apolloClient = new ApolloClient({
  networkInterface,
  shouldBatch: true,
});

// Now queries will be batched
```

<h3 id="addQueryMerging" title="addQueryMerging">addQueryMerging(networkInterface)</h3>

```js
import { addQueryMerging } from 'apollo-client';

const batchingNetworkInterface = addQueryMerging(myCustomNetworkInterface);
```

This function takes an arbitrary `NetworkInterface` implementation and returns a `BatchedNetworkInterface` that batches queries together using query merging. You don't need to use this on the standard HTTP network interface generated by `createNetworkInterface`.

<h3 id="QueryMerging">How query merging works</h3>

Apollo can provide batching functionality over a standard `NetworkInterface` implementation that does not typically support batching. It does this by merging queries together under one root query and then unpacking the merged result returned by the server.

It's easier to understand with an example. Consider the following GraphQL queries:

```graphql
query someAuthor {
  author {
    firstName
    lastName
  }
}
```

```graphql
query somePerson {
  person {
    name
  }
}
```

If these two queries are fired within one batching interval, Apollo client will internally merge these two queries into the following:

```graphql
query __composed {
  ___someAuthor___requestIndex_0__fieldIndex_0: author {
    firstName
    lastName
  }

  ___somePerson___requestIndex_1__fieldIndex_0: person {
    name
  }
}
```

Once the results are returned for this query, Apollo will take care of unpacking the merged result and present your code with data that looks like the following:

```json
{
  "data": {
    "author": {
      "firstName": "John",
      "lastName": "Smith"
    }
  }
}
```

```json
{
  "data": {
    "person": {
      "name": "John Smith"
    }
  }
}
```

This means that your client code and server implementation can remain completely oblivious to the batching that Apollo performs.

<h3 id="BatchedNetworkInterface" title="BatchedNetworkInterface">interface BatchedNetworkInterface</h3>

If you want to implement a network interface that natively supports batching, for example by sending queries to a special endpoint that can handle multiple operations, you can do that by implementing a special method in your network interface, in addition to the normal `query` method:

- `batchQuery(request: GraphQLRequest[]): Promise<GraphQLResult[]>` This function on a batched network interface that takes an array of GraphQL request objects, submits a batched request that represents each of the requests and returns a promise. This promise is resolved with the results of each of the GraphQL requests. The promise should be rejected in case of a network error.
