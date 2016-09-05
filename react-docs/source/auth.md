---
title: Authentication
order: 20
---

Some applications don't deal with sensitive data and have no need to authenticate users, but most applications have some sort of users, accounts and permissions systems. If different users have different permissions in your application, then you need a way to tell the server which user is associated with each request. Over HTTP, the most common way is to send along an authorization header.

Apollo Client has a pluggable [network interface](/core/network.html) that lets you modify requests before they are sent to the server.
That makes it easy to add a network interface middleware that adds the `authorization` header to every HTTP request:

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

The example above shows how to send an authorization header along with every request made. The server can use that header to authenticate the user and attach it to the GraphQL execution context, so resolvers can modify their behavior based on a user's role and permissions.

Another common way of adding credentials for authentication to a request is to use cookies. GitHunt uses GitHub's OAuth authentication, and stores the token in a cookie. Cookies can be added to every request with the `credentials` option (the network interface simply passes that option on to the [fetch](https://github.com/github/fetch) call):

```js
const client = new ApolloClient({
  networkInterface: createNetworkInterface('/graphql', {
    credentials: 'same-origin',
  })
});
```

<h3 id="login-logout">Login and logout</h3>

In order for the examples in the previous section to work properly, your application has to obtain authentication credentials (for example a JWT) when the user logs in, store it somehow (for example in LocalStorage) and reload the parts of the UI that are different for logged-in users. It is also equally important to clear the token from local storage when the user logs out and clear ApolloClient's store if it contains sensitive information.

The easiest way to ensure that the UI and store state reflects the current user's permissions is to call `ApolloClient.resetStore()` after the login or logout actions have completed. This will cause the store to be cleared and all queries to be refetched. Another option is to reload the page, which will have a similar effect.
