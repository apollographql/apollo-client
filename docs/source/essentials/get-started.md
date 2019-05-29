---
title: Get started
description: Learn how to quickly set up Apollo Client in your React app
---

The simplest way to get started with Apollo Client is by using Apollo Boost, our starter kit that configures your client for you with our recommended settings. Apollo Boost includes packages that we think are essential for building an Apollo app, like our in memory cache, local state management, and error handling. It's also flexible enough to handle features like authentication.

If you're an advanced user who would like to configure Apollo Client from scratch, head on over to our [Apollo Boost migration guide](/advanced/boost-migration/). For the majority of users, Apollo Boost should meet your needs, so we don't recommend switching unless you absolutely need more customization.

## Installation

First, let's install some packages!

```bash
npm install apollo-boost react-apollo graphql
```

- `apollo-boost`: Package containing everything you need to set up Apollo Client
- `react-apollo`: View layer integration for React
- `graphql`: Also parses your GraphQL queries

> If you'd like to walk through this tutorial yourself, we recommend either running a new React project locally with [`create-react-app`](https://reactjs.org/docs/create-a-new-react-app.html) or creating a new React sandbox on [CodeSandbox](https://codesandbox.io/). For reference, we will be using [this CodeSandbox](https://codesandbox.io/s/48p1r2roz4) as our GraphQL server for our sample app, which pulls exchange rate data from the Coinbase API. If you'd like to skip ahead and see the app we're about to build, you can view it on [CodeSandbox](https://codesandbox.io/s/nn9y2wzyw4).

## Create a client

Great, now that you have all the dependencies you need, let's create your Apollo Client. The only thing you need to get started is the endpoint for your [GraphQL server](https://codesandbox.io/s/48p1r2roz4). If you don't pass in `uri` directly, it defaults to the `/graphql` endpoint on the same host your app is served from.

In our `index.js` file, let's import `ApolloClient` from `apollo-boost` and add the endpoint for our GraphQL server to the `uri` property of the client config object.

```js
import ApolloClient from "apollo-boost";

const client = new ApolloClient({
  uri: "https://48p1r2roz4.sse.codesandbox.io"
});
```

That's it! Now your client is ready to start fetching data. Before we hook up Apollo Client to React, let's try sending a query with plain JavaScript first. In the same `index.js` file, try calling `client.query()`. Remember to first import the `gql` function for parsing your query string into a query document.

```js
import { gql } from "apollo-boost";
// or you can use `import gql from 'graphql-tag';` instead

...

client
  .query({
    query: gql`
      {
        rates(currency: "USD") {
          currency
        }
      }
    `
  })
  .then(result => console.log(result));
```

Open up your console and inspect the result object. You should see a `data` property with `rates` attached, along with some other properties like `loading` and `networkStatus`. While you don't need React or another front-end framework just to fetch data with Apollo Client, our view layer integrations make it easier to bind your queries to your UI and reactively update your components with data. Let's learn how to connect Apollo Client to React so we can start building query components with `react-apollo`.

## Connect your client to React

To connect Apollo Client to React, you will need to use the `ApolloProvider` component exported from `react-apollo`. The `ApolloProvider` is similar to React's [context provider](https://github.com/reactjs/rfcs/blob/master/text/0002-new-version-of-context.md). It wraps your React app and places the client on the context, which allows you to access it from anywhere in your component tree.

In `index.js`, let's wrap our React app with an `ApolloProvider`. We suggest putting the `ApolloProvider` somewhere high in your app, above any places where you need to access GraphQL data. For example, it could be outside of your root route component if you're using React Router.

```jsx
import React from "react";
import { render } from "react-dom";

import { ApolloProvider } from "react-apollo";

const App = () => (
  <ApolloProvider client={client}>
    <div>
      <h2>My first Apollo app 🚀</h2>
    </div>
  </ApolloProvider>
);

render(<App />, document.getElementById("root"));
```

## Request data

Once your `ApolloProvider` is hooked up, you're ready to start requesting data with `Query` components! `Query` is a React component exported from `react-apollo` that uses the [render prop pattern](https://reactjs.org/docs/render-props.html) to share GraphQL data with your UI.

First, pass your GraphQL query wrapped in the `gql` function to the `query` prop on the `Query` component. Then, you'll provide a function to the `Query` component's `children` prop to determine what to render, which `Query` will call with an object containing `loading`, `error`, and `data` properties. Apollo Client tracks error and loading state for you, which will be reflected in the `loading` and `error` properties. Once the result of your query comes back, it will be attached to the `data` property.

Let's create an `ExchangeRates` component in `index.js` to see the `Query` component in action!

```jsx
import { Query } from "react-apollo";
import { gql } from "apollo-boost";

const ExchangeRates = () => (
  <Query
    query={gql`
      {
        rates(currency: "USD") {
          currency
          rate
        }
      }
    `}
  >
    {({ loading, error, data }) => {
      if (loading) return <p>Loading...</p>;
      if (error) return <p>Error :(</p>;

      return data.rates.map(({ currency, rate }) => (
        <div key={currency}>
          <p>{currency}: {rate}</p>
        </div>
      ));
    }}
  </Query>
);
```

Congrats, you just made your first `Query` component! 🎉 If you render your `ExchangeRates` component within your `App` component from the previous example, you'll first see a loading indicator and then data on the page once it's ready. Apollo Client automatically caches this data when it comes back from the server, so you won't see a loading indicator if you run the same query twice.

If you'd like to play around with the app we just built, you can view it on [CodeSandbox](https://codesandbox.io/s/nn9y2wzyw4). Don't stop there! Try building more `Query` components and experimenting with the concepts you just learned.

If you'd like to explore further, here are more versions of the example app featuring different front-end libraries:

- React Native Web: https://codesandbox.io/s/xk7zw3n4
<!-- - Vue: https://codesandbox.io/s/3vm8vq6kwq -->
- Angular (Ionic): https://github.com/aaronksaunders/ionicLaunchpadApp

## Apollo Boost

In our example app, we used Apollo Boost in order to quickly set up Apollo Client. While your GraphQL server endpoint is the only configuration option you need to get started, there are some other options we've included so you can quickly implement features like local state management, authentication, and error handling.

### What's included

Apollo Boost includes some packages that we think are essential to developing with Apollo Client. Here's what's included:

- `apollo-client`: Where all the magic happens
- `apollo-cache-inmemory`: Our recommended cache
- `apollo-link-http`: An Apollo Link for remote data fetching
- `apollo-link-error`: An Apollo Link for error handling
- `apollo-link-state`: An Apollo Link for local state management

The awesome thing about Apollo Boost is that you don't have to set any of this up yourself! Just specify a few options if you'd like to use these features and we'll take care of the rest.

### Configuration options

Here are the options you can pass to the `ApolloClient` exported from `apollo-boost`. All of them are optional.

<dl>
  <dt>`uri`: string</dt>
  <dd>A string representing your GraphQL server endpoint. Defaults to `/graphql`</dd>
  <dt>`fetchOptions`: Object</dt>
  <dd>Any options you would like to pass to fetch (credentials, headers, etc). These options are static, so they don't change on each request.</dd>
  <dt>`request`: (operation: Operation) => Promise &lt;void&gt;</dt>
  <dd>This function is called on each request. It takes a GraphQL operation and can return a promise. To dynamically set `fetchOptions`, you can add them to the context of the operation with `operation.setContext({ headers })`. Any options set here will take precedence over `fetchOptions`. Useful for authentication.</dd>
  <dt>`onError`: (errorObj: { graphQLErrors: GraphQLError[], networkError: Error, response?: ExecutionResult, operation: Operation }) => void</dt>
  <dd>We include a default error handler to log out your errors to the console. If you would like to handle your errors differently, specify this function.</dd>
  <dt>`clientState`: { resolvers?: Object, defaults?: Object, typeDefs?: string | Array &lt;string&gt; }</dt>
  <dd>An object representing your configuration for `apollo-link-state`. This is useful if you would like to use the Apollo cache for local state management. Learn more in our <a href="/docs/link/links/state.html#start">quick start</a>.</dd>
  <dt>`cacheRedirects`: Object</dt>
  <dd>A map of functions to redirect a query to another entry in the cache before a request takes place. This is useful if you have a list of items and want to use the data from the list query on a detail page where you're querying an individual item. More on that <a href="/features/performance/#cache-redirects-with-cacheredirects">here</a>.</dd>
  <dt>`credentials`: string</dt>
  <dd>Is set to `same-origin` by default. This option can be used to indicate whether the user agent should send cookies with requests. See <a href="https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials">Request.credentials</a> for more details.</dd>
  <dt>`headers`: Object</dt>
  <dd>Header key/value pairs to pass along with the request.</dd>
  <dt>`fetch`: GlobalFetch['fetch']</dt>
  <dd>A <a href="https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API">`fetch`</a> compatible API for making a request.</dd>
  <dt>`cache`: ApolloCache</dt>
  <dd>A custom instance of `ApolloCache` to be used. The default value is `InMemoryCache` from `apollo-cache-inmemory`. This option is quite useful for using a custom cache with `apollo-cache-persist`.</dd>
</dl>

## Next steps

Now that you've learned how to fetch data with Apollo Client, you're ready to dive deeper into creating more complex queries and mutations. After this section, we recommend moving onto:

- [Queries](/essentials/queries/): Learn how to fetch queries with arguments and dive deeper into configuration options. For a full list of options, check out the API reference for `Query`.
- [Mutations](/essentials/mutations/): Learn how to update data with mutations and when you'll need to update the Apollo cache. For a full list of options, check out the API reference for `Mutation` components.
- [Apollo Client API](/api/apollo-client/): Sometimes, you'll need to access the client directly like we did in our plain JavaScript example above. Visit the API reference for a full list of options.
