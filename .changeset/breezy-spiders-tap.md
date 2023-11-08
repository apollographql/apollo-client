---
"@apollo/client": patch
---

Add a `defaultContext` option and property on `ApolloClient`, e.g. for keeping track of changing auth tokens or dependency injection.

This can be used e.g. in authentication scenarios, where a new token might be
generated outside of the link chain and should passed into the link chain.

```js
import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: '/graphql',
});

const authLink = setContext((_, { headers, token }) => {
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});

// somewhere else in your application
function onNewToken(newToken) {
  // token can now be changed for future requests without need for a global
  // variable, scoped ref or recreating the client
  client.defaultContext.token = newToken
}
```
