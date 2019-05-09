---
title: Network layer (Apollo Link)
order: 110
description: How to configure Apollo Client's network layer.
---

Now that you have learned how to read and update your data, its helpful to know how to direct where your data comes from and where it goes! Apollo has a powerful way to manage your network layer using a library called [Apollo Link](https://www.apollographql.com/docs/link/).

## Apollo Link

Apollo Client has a pluggable network interface layer, which can let you configure how queries are sent over HTTP, or replace the whole network part with something completely custom, like a websocket transport, mocked server data, or anything else you can imagine.

### Using a link

To create a link to use with Apollo Client, you can install and import one from npm or create your own. We recommend using `apollo-link-http` for most setups.

Here's how you would instantiate a new client with a custom endpoint URL using the HttpLink:

```js
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';

const link = new HttpLink({ uri: 'https://example.com/graphql' });

const client = new ApolloClient({
  link,
  // other options like cache
});
```

And if you needed to pass additional options to [`fetch`](https://github.github.io/fetch/):

```js
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';

const link = new HttpLink({
  uri: 'https://example.com/graphql',
  // Additional fetch options like `credentials` or `headers`
  credentials: 'same-origin',
});

const client = new ApolloClient({
  link,
  // other options like cache
});
```

### Middleware

Apollo Link is designed from day one to be easy to use middleware on your requests. Middlewares are used to inspect and modify every request made over the `link`, for example, adding authentication tokens to every query. In order to add middleware, you simply create a new link and join it with the `HttpLink`.

The following examples shows how you'd create a middleware. In both examples, we'll show how you would add an authentication token to the HTTP header of the requests being sent by the client.

```js
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { ApolloLink, concat } from 'apollo-link';

const httpLink = new HttpLink({ uri: '/graphql' });

const authMiddleware = new ApolloLink((operation, forward) => {
  // add the authorization to the headers
  operation.setContext({
    headers: {
      authorization: localStorage.getItem('token') || null,
    }
  });

  return forward(operation);
})

const client = new ApolloClient({
  link: concat(authMiddleware, httpLink),
});
```

The above example shows the use of a single middleware joined with the HttpLink. It checks to see if we have a token (JWT, for example) and passes that token into the HTTP header of the request, so we can authenticate interactions with GraphQL performed through our network interface.

The following example shows the use of multiple middlewares passed as an array:

```js
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { ApolloLink, from } from 'apollo-link';

const httpLink = new HttpLink({ uri: '/graphql' });

const authMiddleware = new ApolloLink((operation, forward) => {
  // add the authorization to the headers
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      authorization: localStorage.getItem('token') || null,
    }
  }));

  return forward(operation);
})

const otherMiddleware = new ApolloLink((operation, forward) => {
  // add the recent-activity custom header to the headers
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      'recent-activity': localStorage.getItem('lastOnlineTime') || null,
    }
  }));

  return forward(operation);
})

const client = new ApolloClient({
  link: from([
    authMiddleware,
    otherMiddleware,
    httpLink
  ]),
});
```

Given the code above, the header's `Authorization` value will be that of `token` from `localStorage` by `authMiddleware` and the `recent-activity` value will  be set by `otherMiddleware` to `lastOnlineTime` again from `localStorage`.  This example shows how you can use more than one middleware to make multiple/separate modifications to the request being processed in the form of a chain.  This example doesn't show the use of `localStorage`, but is instead just meant to demonstrate the use of more than one middleware using Apollo Link.

### Afterware

'Afterware' is very similar to a middleware, except that an afterware runs after a request has been made,
that is when a response is going to get processed. It's perfect for responding to the situation where a user becomes logged out during their session.

Much like middlewares, Apollo Link was designed to make afterwares easy and powerful to use with Apollo!

The following example demonstrates how to implement an afterware function.

```js
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { onError } from 'apollo-link-error';

import { logout } from './logout';

const httpLink = new HttpLink({ uri: '/graphql' });

const logoutLink = onError(({ networkError }) => {
  if (networkError.statusCode === 401) logout();
})

const client = new ApolloClient({
  link: logoutLink.concat(httpLink),
});
```

The above example shows the use of `apollo-link-error` to handle network errors from a response.
It checks to see if the response status code is equal to 401 and if it is then we will
logout the user from the application.

### Query deduplication

Query deduplication can help reduce the number of queries that are sent over the wire. It is turned on by default, but can be turned off by passing `queryDeduplication: false` to the context on each requests or using the `defaultOptions` key on Apollo Client setup. If turned on, query deduplication happens before the query hits the network layer.

Query deduplication can be useful if many components display the same data, but you don't want to fetch that data from the server many times. It works by comparing a query to all queries currently in flight. If an identical query is currently in flight, the new query will be mapped to the same promise and resolved when the currently in-flight query returns.

## Other links

The network stack of Apollo Client is easily customized using Apollo Link! It can log errors, send side effects, send data over WebSockets or HTTP, and so much more. A few examples are below but make sure to check out the [link docs](https://www.apollographql.com/docs/link/) to learn more!

### GraphQL over WebSocket

Another alternative for network interface is GraphQL over WebSocket, using [`subscriptions-transport-ws`](https://github.com/apollographql/subscriptions-transport-ws/).

You can then create WebSocket as full-transport, and pass all GraphQL operations over the WebSocket (`Query`, `Mutation` and `Subscription`), or use a hybrid network interface and execute `Query` and `Mutation` over HTTP, and only `Subscription` over the WebSocket.

For more information about using WebSockets with Apollo Link, check out the [in-depth guide](https://www.apollographql.com/docs/link/links/ws)

### Query Batching

Apollo lets you automatically batch multiple queries into one request when they are made within a certain interval. This means that if you render several components, for example a navbar, sidebar, and content, and each of those do their own GraphQL query, they will all be sent in one roundtrip. Batching works only with server that support batched queries (for example graphql-server). Batched requests to servers that don’t support batching will fail. To learn how to use batching with Apollo checkout the [in-depth guide](https://www.apollographql.com/docs/link/links/batch-http)

### Mutation batching

Apollo also lets you automatically run multiple mutations in one request, similar to queries, by batching multiple mutations into one request.
