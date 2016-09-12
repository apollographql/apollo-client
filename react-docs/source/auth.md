---
title: Authentication
order: 20
---

Unless all of the data you are loading is completely public, your app has some sort of users, accounts and permissions systems. If different users have different permissions in your application, then you need a way to tell the server which user is associated with each request.

Apollo Client comes with a pluggable [HTTP network interface](/core/network.html) that includes several options for authentication.

## Cookie

If your app is browser based and you are using cookies for login, it's very easy to tell your network interface to send the cookie along with every request. You just need to pass the `{ credentials: 'same-origin' }` option:

```js
const networkInterface = createNetworkInterface({
  uri: '/graphql',
  opts: {
    credentials: 'same-origin',
  },
});

const client = new ApolloClient({
  networkInterface,
});
```

This option is simply passed through to the [`fetch` polyfill](https://github.com/github/fetch) used by the network interface when sending the query.

## Header

Another common way to identify yourself when using HTTP is to send along an authorization header. The Apollo network interface has a middleware feature that lets you modify requests before they are sent to the server. It's easy to add an `authorization` header to every HTTP request. In this example, we'll pull the login token from `localStorage` every time a request is sent:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';

const networkInterface = createNetworkInterface('/graphql');

networkInterface.use([{
  applyMiddleware(req, next) {
    if (!req.options.headers) {
      req.options.headers = {};  // Create the header object if needed.
    }

    // get the authentication token from local storage if it exists
    req.options.headers.authorization = localStorage.getItem('token') || null;
    next();
  }
}]);

const client = new ApolloClient({
  networkInterface,
});
```

The server can use that header to authenticate the user and attach it to the GraphQL execution context, so resolvers can modify their behavior based on a user's role and permissions.

<h2 id="login-logout">Reset store on logout</h2>

Since Apollo caches all of your query results, it's important to get rid of them when the login state changes.

The easiest way to ensure that the UI and store state reflects the current user's permissions is to call `client.resetStore()` after your login or logout process has completed. This will cause the store to be cleared and all active queries to be refetched. Another option is to reload the page, which will have a similar effect.
