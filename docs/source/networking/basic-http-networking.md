---
title: Basic HTTP Networking
description: Communicating with a GraphQL endpoint using HTTP.
---

## Connecting to a GraphQL endpoint

Now that you have learned how to read and update your data, it's helpful to know how to direct where your data comes from and where it goes.

You can configure Apollo Client to communicate with a backend GraphQL endpoint using the `ApolloClient` constructor `uri` option. If set, Apollo Client will send GraphQL operations (queries and mutations) to the specified endpoint, over HTTP.

```js
import { ApolloClient } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.somedomain.com'
});
```

## Controlling credentials

Apollo Client will send user credentials (basic auth, cookies, etc.) alongside HTTP requests it makes to the endpoint configured with `uri` (see [Connecting to a GraphQL endpoint](#connecting-to-a-graphql-endpoint)). By default credentials will only be sent if the endpoint is on the same origin as the application using `ApolloClient`. The `ApolloClient` constructor `credentials` option can be used to adjust this policy.

```js
import { ApolloClient } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.somedomain.com',
  // Enable sending cookies over cross-origin requests
  credentials: 'include'
});
```

Possible `credentials` options:

| Option | Description |
| - | - |
| `omit` | Never send or receive cookies. |
| `same-origin` | Send user credentials (cookies, basic http auth, etc..) if the URL is on the same origin as the calling script. This is the default value. |
| `include` | Always send user credentials (cookies, basic http auth, etc..), even for cross-origin calls. |

For more information, refer to the [`Request.credentials`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials) API docs.

## Adding request headers

Request headers can be added to Apollo Client HTTP requests using the `ApolloClient` constructor `headers` option.

```js
import { ApolloClient } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.somedomain.com',
  headers: {
    authorization: localStorage.getItem('token'),
    'client-name': 'WidgetX Ecom [web]',
    'client-version': '1.0.0'
  }
});
```
