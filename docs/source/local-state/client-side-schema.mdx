---
title: Client-side schema
description: Configure a client-side schema with Apollo Client
---

You can optionally set a client-side schema to be used with Apollo Client, through either the `ApolloClient` constructor `typeDefs` parameter, or the local state API `setTypeDefs` method. Your schema should be written in [Schema Definition Language](https://www.apollographql.com/docs/graphql-tools/generate-schema#schema-language). This schema is not used for validation like it is on the server because the `graphql-js` modules for schema validation would dramatically increase your bundle size. Instead, your client-side schema is used for introspection in [Apollo Client Devtools](https://github.com/apollographql/apollo-client-devtools), where you can explore your schema in GraphiQL.

The following demonstrates how to configure a client-side schema through the `ApolloClient` constructor:

```js
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const typeDefs = gql`
  extend type Query {
    isLoggedIn: Boolean!
    cartItems: [Launch]!
  }

  extend type Launch {
    isInCart: Boolean!
  }

  extend type Mutation {
    addOrRemoveFromCart(id: ID!): [Launch]
  }
`;

const client = new ApolloClient({
  cache: new InMemoryCache(),
  uri: 'http://localhost:4000/graphql',
  typeDefs,
});
```

If you open up Apollo Client Devtools and click on the `GraphiQL` tab, you'll be able to explore your client schema in the "Docs" section. This example doesn't include a remote schema, but if it did, you would be able to see your local queries and mutations alongside your remote ones.

![GraphiQL Console](../assets/client-schema.png)
