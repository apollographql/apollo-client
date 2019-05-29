---
title: Apollo Boost migration
description: Learn how to set up Apollo Client manually without Apollo Boost
---

Apollo Boost is a great way to get started with Apollo Client quickly, but there are some advanced features it doesn't support out of the box. If you'd like to use subscriptions, swap out the Apollo cache, or add an existing Apollo Link to your network stack that isn't already included, you will have to set Apollo Client up manually.

We're working on an eject feature for Apollo Boost that will make migration easier in the future, but for now, let's walk through how to migrate off of Apollo Boost.

## Basic migration

If you're not using any configuration options on Apollo Boost, migration should be relatively simple. All you will have to change is the file where you initialize `ApolloClient`.

### Before

Here's what client initialization looks like with Apollo Boost:

```js
import ApolloClient from "apollo-boost";

const client = new ApolloClient({
  uri: "https://w5xlvm3vzz.lp.gql.zone/graphql"
});
```

### After

To create a basic client with the same defaults as Apollo Boost, first you need to install some packages:

```bash
npm install apollo-client apollo-cache-inmemory apollo-link-http apollo-link-error apollo-link graphql-tag --save
```

To complete the process, you'll need to manually attach your `cache` and `link` to the client:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { onError } from 'apollo-link-error';
import { ApolloLink } from 'apollo-link';

const client = new ApolloClient({
  link: ApolloLink.from([
    onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors)
        graphQLErrors.map(({ message, locations, path }) =>
          console.log(
            `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
          ),
        );
      if (networkError) console.log(`[Network error]: ${networkError}`);
    }),
    new HttpLink({
      uri: 'https://w5xlvm3vzz.lp.gql.zone/graphql',
      credentials: 'same-origin'
    })
  ]),
  cache: new InMemoryCache()
});
```

The `InMemoryCache` is our recommended cache implementation for Apollo Client. The `HttpLink` is an Apollo Link that sends HTTP requests. Your network stack can be made up of one or more links, which you can chain together to create a customizable network stack. Learn more in our [network layer](/advanced/network-layer/) guide or the [Apollo Link](https://www.apollographql.com/docs/link) docs.

## Advanced migration

If you are using configuration options on Apollo Boost, your migration path will vary depending on which ones you use. The next example will show an Apollo Boost client configured with every possible option.

### Before

Here's what client initialization looks like with Apollo Boost:

```js
import ApolloClient from 'apollo-boost';

const client = new ApolloClient({
  uri: 'https://w5xlvm3vzz.lp.gql.zone/graphql',
  fetchOptions: {
    credentials: 'include'
  },
  request: async (operation) => {
    const token = await AsyncStorage.getItem('token');
    operation.setContext({
      headers: {
        authorization: token
      }
    });
  },
  onError: ({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      sendToLoggingService(graphQLErrors);
    }
    if (networkError) {
      logoutUser();
    }
  },
  clientState: {
    defaults: {
      isConnected: true
    },
    resolvers: {
      Mutation: {
        updateNetworkStatus: (_, { isConnected }, { cache }) => {
          cache.writeData({ data: { isConnected }});
          return null;
        }
      }
    }
  },
  cacheRedirects: {
    Query: {
      movie: (_, { id }, { getCacheKey }) =>
        getCacheKey({ __typename: 'Movie', id });
    }
  }
});
```

### After

To create a client with the same defaults as Apollo Boost, first you need to install some packages:

```bash
npm install apollo-client apollo-cache-inmemory apollo-link-http apollo-link apollo-link-state apollo-link-error graphql-tag --save
```

Here's how we would create our new client using the configuration options above from Apollo Boost:

```js
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import { onError } from 'apollo-link-error';
import { withClientState } from 'apollo-link-state';
import { ApolloLink, Observable } from 'apollo-link';

const cache = new InMemoryCache({
  cacheRedirects: {
    Query: {
      movie: (_, { id }, { getCacheKey }) =>
        getCacheKey({ __typename: 'Movie', id });
    }
  }
});

const request = async (operation) => {
  const token = await AsyncStorage.getItem('token');
  operation.setContext({
    headers: {
      authorization: token
    }
  });
};

const requestLink = new ApolloLink((operation, forward) =>
  new Observable(observer => {
    let handle;
    Promise.resolve(operation)
      .then(oper => request(oper))
      .then(() => {
        handle = forward(operation).subscribe({
          next: observer.next.bind(observer),
          error: observer.error.bind(observer),
          complete: observer.complete.bind(observer),
        });
      })
      .catch(observer.error.bind(observer));

    return () => {
      if (handle) handle.unsubscribe();
    };
  })
);

const client = new ApolloClient({
  link: ApolloLink.from([
    onError(({ graphQLErrors, networkError }) => {
      if (graphQLErrors) {
        sendToLoggingService(graphQLErrors);
      }
      if (networkError) {
        logoutUser();
      }
    }),
    requestLink,
    withClientState({
      defaults: {
        isConnected: true
      },
      resolvers: {
        Mutation: {
          updateNetworkStatus: (_, { isConnected }, { cache }) => {
            cache.writeData({ data: { isConnected }});
            return null;
          }
        }
      },
      cache
    }),
    new HttpLink({
      uri: 'https://w5xlvm3vzz.lp.gql.zone/graphql',
      credentials: 'include'
    })
  ]),
  cache
});
```
