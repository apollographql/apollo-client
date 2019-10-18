---
title: Advanced HTTP Networking
description: Taking full network control with Apollo Link.
---

If you're looking for more fine-grained control over your Apollo Client HTTP based network requests (and the [basic HTTP networking](/networking/basic-http-networking/) features don't give you enough flexibility), you can take command of Apollo Client's network layer using Apollo Link.

## Apollo Link

Apollo Client's pluggable network interface layer is called Apollo Link. Apollo Link allows you to configure how queries are sent over HTTP. It can also be used to replace the entire network piece of Apollo Client with something completely custom, like a websocket transport, mocked server data, or anything else you can imagine.

### Using a link

To create a link to use with Apollo Client, you can install and import one from npm or create your own. Here's a quick example using Apollo Client's [`HttpLink`](#HttpLink):

```js
import { ApolloClient, HttpLink } from '@apollo/client';

const link = new HttpLink({ uri: 'https://example.com/graphql' });

const client = new ApolloClient({
  link
});
```

### Middleware

Apollo Link was designed from day one to be easy to use middleware for your requests. Apollo Link can inspect and modify all Apollo Client request's, which comes in handy for doing things like adding authentication tokens to every query.

```js
import { ApolloClient, HttpLink, ApolloLink, concat } from '@apollo/client';

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

The above example shows the use of a single middleware joined with `HttpLink`. It checks to see if we have a token (JWT, for example) and passes that token into the HTTP header of the request, so we can authenticate interactions with GraphQL performed through our network interface.

The following example shows the use of multiple middleware's passed as an array:

```js
import { ApolloClient, HttpLink, ApolloLink, from } from '@apollo/client';

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

In the code above, the header's `Authorization` value will be that of `token` from `localStorage` by `authMiddleware` and the `recent-activity` value will be set by `otherMiddleware` to `lastOnlineTime` again from `localStorage`. This example shows how you can use more than one middleware to make multiple/separate modifications to the request being processed in the form of a chain. This example doesn't show the use of `localStorage`, but is instead just meant to demonstrate the use of more than one middleware using Apollo Link.

### Afterware

Afterware is very similar to middleware, except that it runs after a request has been made, and the response is about to be processed. Much like middleware, Apollo Link was designed to make afterware easy and powerful to use with Apollo. As an example, it's perfect for responding to situations where a user becomes logged out during their session.

The following example demonstrates how to implement an afterware function.

```js
import { ApolloClient, HttpLink } from '@apollo/client';
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

The above example shows the use of [`apollo-link-error`](/api/link/apollo-link-error/) to handle network errors from a response. It checks to see if the response status code is equal to 401, and if it is logs the user out of the application.

## HttpLink

`HttpLink` is the most common Apollo Link. It's used to fetch GraphQL results from a GraphQL endpoint over an HTTP connection. `HttpLink` supports both POST and GET requests, and has the ability to change HTTP options on a per query basis. This comes in handy when using authentication, persisted queries, dynamic URI's, and other granular updates.

> **Note:** Depending on the complexity of your HTTP request needs, there's a good chance you can connect Apollo Client to a backend GraphQL endpoint without having to worry about creating your own `HttpLink` instance. For more details about this, refer to the [basic HTTP networking](/networking/basic-http-networking/) section.

### Usage

```js
import { HttpLink } from "@apollo/client";

const link = new HttpLink({ uri: "/graphql" });
```

### Options

The `HttpLink` constructor accepts the following options:

| Options | Description |
| - | - |
| `uri` | The URI key is a string endpoint or function resolving to an endpoint -- will default to "/graphql" if not specified. |
| `includeExtensions` | Allow passing the extensions field to your graphql server, defaults to false. |
| `fetch` | A `fetch` compatible API for making a request. |
| `headers` | An object representing values to be sent as headers on the request. |
| `credentials` | A string representing the credentials policy you want for the fetch call. Possible values are: `omit`, `include` and `same-origin`. |
| `fetchOptions` | Any overrides of the fetch options argument to pass to the fetch call. |
| `useGETForQueries` | Set to `true` to use the HTTP `GET` method for queries (but not for mutations). |

### Fetch polyfill

`HttpLink` relies on having `fetch` present in your runtime environment. If you are running on react-native, or modern browsers, this should not be a problem. If you are targeting an environment without `fetch` such as older browsers or the server however, you will need to pass your own `fetch` to the link through its options. We recommend [`unfetch`](https://github.com/developit/unfetch) for older browsers and [`node-fetch`](https://github.com/bitinn/node-fetch) for Node.

### Context

Many of the `HttpLink` constructor options can be overridden at the request level, by passing them into the context. For example, the `headers` field on the context can be used to pass headers to the HTTP request. It also supports the `credentials` field for defining credentials policy, `uri` for changing the endpoint dynamically, and `fetchOptions` to allow generic fetch overrides (i.e. `method: "GET"`). These options will override the same key if set by the `HttpLink` constructor.

Note that if you set `fetchOptions.method` to `GET`, `HttpLink` will follow the [standard GraphQL HTTP GET encoding](http://graphql.org/learn/serving-over-http/#get-request): the query, variables, operation name, and extensions will be passed as query parameters rather than in the HTTP request body. If you want mutations to continue to be sent as non-idempotent `POST` requests, set the top-level `useGETForQueries` option to `true` instead of setting `fetchOptions.method` to `GET`.

`HttpLink` also attaches the response from the `fetch` operation to the context as `response`, so you can access it in another link.

Context options:

| Option | Description |
| - | - |
| `headers` | An object representing values to be sent as headers on the request. |
| `credentials` | A string representing the credentials policy you want for the fetch call. Possible values are: `omit`, `include` and `same-origin`. |
| `uri` | A string of the endpoint you want to fetch from. |
| `fetchOptions` | Any overrides of the fetch options argument to pass to the fetch call. |
| `response` | This is the raw response from the fetch request after it is made. |
| `http` | This is an object to control fine grained aspects of the http link itself, such as persisted queries (see below). |

The following example shows how to leverage the context to pass a special header for a single query invocation:

```js
import { ApolloClient } from "@apollo/client";

const client = new ApolloClient({ uri: "/graphql" });

client.query({
  query: MY_QUERY,
  context: {
    // example of setting the headers with context per operation
    headers: {
      special: "Special header value"
    }
  }
});
```

### Custom fetching

`HttpLink`'s `fetch` option can be used to wire in custom networking. This is useful if you want to modify the request based on calculated headers, or calculate the URI based on an operation. For example:

**Custom auth:**

```js
const customFetch = (uri, options) => {
  const { header } = Hawk.client.header(
    "http://example.com:8000/resource/1?b=1&a=2",
    "POST",
    { credentials: credentials, ext: "some-app-data" }
  );
  options.headers.Authorization = header;
  return fetch(uri, options);
};

const link = new HttpLink({ fetch: customFetch });
```

**Dynamic URI:**

```js
const customFetch = (uri, options) => {
  const { operationName } = JSON.parse(options.body);
  return fetch(`${uri}/graph/graphql?opname=${operationName}`, options);
};

const link = new HttpLink({ fetch: customFetch });
```

## Other links

Apollo Client's network stack can be easily customized using Apollo Link. It can log errors, trigger side effects, send data over WebSockets or HTTP, and so much more. Refer to the [Link API](/api/link/introduction/) for more details around building your own custom links, and for a list of additional Apollo supported links. [NPM](https://www.npmjs.com/search?q=apollo-link) is also a great place to find community created links.
