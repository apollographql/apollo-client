---
title: Basic HTTP Networking
description: Communicate with a GraphQL server over HTTP
---

Apollo Client has built-in support for communicating with a GraphQL server over HTTP. To set up this communication, provide the server's URL as the `uri` parameter to the `ApolloClient` constructor:

```js
import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.example.com',
  cache: new InMemoryCache()
});
```

If you provide this parameter, Apollo Client sends all GraphQL operations (queries and mutations) to the specified URL over HTTP.

## Including credentials in requests

Apollo Client can include user credentials (basic auth, cookies, etc.) in the HTTP requests it makes to a GraphQL server. By default, credentials are included only if the server is hosted at the same origin as the application using Apollo Client. You can adjust this behavior by providing a value for the `credentials` parameter to the `ApolloClient` constructor:

```js
import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.example.com',
  cache: new InMemoryCache(),
  // Enable sending cookies over cross-origin requests
  credentials: 'include'
});
```

The following values for `credentials` are supported:

| Option | Description |
| - | - |
| `same-origin` | Send user credentials (cookies, basic http auth, etc.) if the server's URL is on the same origin as the requesting client. This is the default value. |
| `omit` | Never send or receive credentials. |
| `include` | Always send user credentials (cookies, basic http auth, etc.), even for cross-origin requests. |

For more information, see [`Request.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials).

## Customizing request headers

You can specify the names and values of custom headers to include in every HTTP request to a GraphQL server. To do so, provide the `headers` parameter to the  `ApolloClient` constructor, like so:

```js
import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.example.com',
  cache: new InMemoryCache(),
  headers: {
    authorization: localStorage.getItem('token'),
    'client-name': 'WidgetX Ecom [web]',
    'client-version': '1.0.0'
  }
});
```
