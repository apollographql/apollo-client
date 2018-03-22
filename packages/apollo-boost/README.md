# apollo-boost 🚀
The fastest, easiest way to get started with Apollo Client!

Apollo Boost is a zero-config way to start using Apollo Client. It includes some sensible defaults, such as our recommended `InMemoryCache` and `HttpLink`, which come configured for you with our recommended settings.

## Quick start

First, install `apollo-boost`. If you don't have `graphql` & `react-apollo@beta` already in your project, please install those too.

```shell
npm i apollo-boost graphql react-apollo@beta -S
```

Next, create your client. Once you create your client, hook it up to your app by passing it to the `ApolloProvider` exported from `react-apollo`.

```js
import React from 'react';
import { render } from 'react-dom';
import ApolloClient from 'apollo-boost';
import { ApolloProvider } from 'react-apollo';

// Pass your GraphQL endpoint to uri
const client = new ApolloClient({ uri: 'https://nx9zvp49q7.lp.gql.zone/graphql' });

const ApolloApp = AppComponent => (
  <ApolloProvider client={client}>
    <AppComponent />
  </ApolloProvider>
);

render(ApolloApp(App), document.getElementById('root'));
```

Awesome! Your ApolloClient is now connected to your app. Let's create our `<App />` component and make our first query:

```js
import React from 'react';
import { gql } from 'apollo-boost';
import { Query } from 'react-apollo';

const GET_MOVIES = gql`
  query {
    movie(id: 1) {
      id
      title
    }
  }
`

const App = () => (
  <Query query={GET_MOVIES}>
    {({ loading, error, data }) => {
      if (loading) return <div>Loading...</div>;
      if (error) return <div>Error :(</div>;

      return (
        <Movie title={data.movie.title} />
      )
    }}
  </Query>
)
```

Time to celebrate! 🎉 You just made your first Query component. The Query component binds your GraphQL query to your UI so Apollo Client can take care of fetching your data, tracking loading & error states, and updating your UI via the `data` prop.

## What's in Apollo Boost

Apollo Boost includes some packages that we think are essential to developing with Apollo Client. Here's what's in the box:
- `apollo-client`: Where all the magic happens
- `apollo-cache-inmemory`: Our recommended cache
- `apollo-link-http`: An Apollo Link for remote data fetching
- `apollo-link-error`: An Apollo Link for error handling
- `apollo-link-state`: An Apollo Link for local state management
- `graphql-tag`: Exports the `gql` function for your queries & mutations

The awesome thing about Apollo Boost is that you don't have to set any of this up yourself! Just specify a few options if you'd like to use these features and we'll take care of the rest.

### Apollo Boost options

Here are the options you can pass to the `ApolloClient` exported from `apollo-boost`. None of them are required.
- uri: A string representing your GraphQL server endpoint. Defaults to `/graphql`
- fetchOptions: An object representing any options you would like to pass to fetch (credentials, headers, etc). These options are static, so they don't change on each request.
- request?: (operation: Operation) => Promise<void>;
  - This function is called on each request. It takes an operation and can return a promise. To dynamically set `fetchOptions`, you can add them to the context of the operation with `operation.setContext({ headers })`. Any options set here will take precedence over `fetchOptions`.
  - Use this function for authentication
- onError: (errorObj: { graphQLErrors: GraphQLError[], networkError: Error, response?: ExecutionResult, operation: Operation }) => void
  - We include a default error handler to log out your errors for you. If you would like to handle your errors differently, specify this function
- clientState: An object representing your configuration for `apollo-link-state`. This is useful if you would like to use the Apollo cache for local state management. Learn more in our [quick start](https://www.apollographql.com/docs/link/links/state.html#start).
- cacheRedirects: An map of functions to redirect a query to another entry in the cache before a request takes place. This is useful if you have a list of items and want to use the data from the list query on a detail page where you're querying an individual item. More on that [here](https://www.apollographql.com/docs/react/advanced/caching.html#cacheRedirect).

That's it! Here's an example of all those options in action:

```js
import ApolloClient from 'apollo-boost';

const client = new ApolloClient({
  uri: 'https://nx9zvp49q7.lp.gql.zone/graphql',
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

