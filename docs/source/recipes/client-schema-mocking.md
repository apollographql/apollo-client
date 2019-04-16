---
title: Mocking new schema capabilities
description: How to build UI features before your GraphQL API supports them
---

Following [schema-first design](https://www.apollographql.com/docs/tutorial/schema.html#write-schema) unlocks a powerful concept around client-side data mocking. As soon as the new schema is defined (or even if it's close), we can begin by writing mocks for fields that _don't even exist yet_ in the API. From there, frontend features can be quickly developed against the proposed schema, and when the feature is ready, switching to the end-to-end code path is a snap. We'll walk through how to accomplish this using the following techniques:

- declaring client-side extensions to the schema using Apollo Client;
- writing client-side resolver functions to supply mock data to any UI component via GraphQL;
- writing GraphQL queries that leverage client-only types and fields.

If you've read the [tutorial guide](https://www.apollographql.com/docs/tutorial/local-state.html#virtual-fields) which describes how to use virtual fields to manage local state, some of these patterns will feel familiar. Let's dive into an example.

Let's say we're building out a new feature in our Space Explorer app — we'd like to display a description of each rocket we can choose — but the backend support for this feature isn't going to be available for another week. In keeping with “schema first” design, we've decided that we'll be adding a new field to the `Rocket` type called `description`.

```js
import React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

const GET_ROCKET_DETAILS = gql`
  query RocketDetails($rocketId: ID!) {
    rocket(id: $rocketId) {
      type
      ### SCHEMA DEFINED, BUT THIS FIELD IS NOT YET AVAILABLE:
      description
    }
  }
`;

export default function RocketDetails({ rocketId }) {
  return (
    <Query query={GET_ROCKET_DETAILS} variables={{ rocketId }}>
      {({ data, loading, error }) => {
        if (loading) return <p>Loading...</p>;
        if (error) return <p>ERROR: {error.message}</p>;

        return (
          <div>
              <p>Rocket Type: {data.rocket.type}</p>
              <!--- TODO: DISPLAY THE ROCKET DESCRIPTION -->
          </div>
        );
      }}
    </Query>
  );
}
```

Even though it doesn't exist in the schema yet, we can take advantage of client schemas to document the addition of `description` as a client-side field.

## 1. Extend your server schema with a client-only field.

Before we can include this data in the UI, we'll need to define a client schema that extends our server schema. We'll start by constructing an instance of ApolloClient and passing in a client schema using the `typeDefs` parameter:

```js
import { ApolloClient } from "apollo-client";
import { InMemoryCache } from "apollo-cache-inmemory";
import { HttpLink } from "apollo-link-http";
import gql from "graphql-tag";

const cache = new InMemoryCache();
const link = new HttpLink({
  uri: "http://localhost:4000/"
});

// 1. define a client schema here by extending the `Rocket` type:
const typeDefs = gql`
  extend type Rocket {
    description: String!
  }
`;

// 2. pass the client schema as typeDefs to Apollo Client:
const client = new ApolloClient({
  cache,
  link,
  typeDefs
});
```

Your schema should be written in [Schema Definition Language](https://deploy-preview-4378--apollo-client-docs.netlify.com/docs/graphql-tools/generate-schema.html#schema-language). Documenting your client-side API in schema form is incredibly valuable, as other developers can easily see what client state is available in your app. Developers familiar with GraphQL schemas should quickly be able to understand how to query for these fields.

Through integrations with Apollo tools, we can further enrich the developer experience. The Apollo Visual Studio Code Plugin provides autocompletion of client-side fields as well as inline mouse-over documentation:

![VSCode Autocompletion](../assets/client-mocking/vscode-autocomplete.png)
![VSCode Type Info](../assets/client-mocking/vscode-typeinfo.png)

We'll also see error messages in the VSCode console if we add fields that collide with the server-side schema:

![VSCode Console Errors](../assets/client-mocking/vscode-errors.png)

Next we'll learn how to actually resolve the types and fields in our client schema.

## 2. Write a local resolver to return mock data.

In order to return some data from a client-side field, we need to specify a _local resolver_ on the `Rocket` type to tell Apollo Client how to resolve your mocked field:

```js
const resolvers = {
  Rocket: {
    description: () => "A boilerplate standard space rocket"
  }
};
```

We also pass these resolvers to the Apollo Client upon construction:

```js
import { ApolloClient } from "apollo-client";
import { InMemoryCache } from "apollo-cache-inmemory";
import { HttpLink } from "apollo-link-http";
import gql from "graphql-tag";

const cache = new InMemoryCache();
const link = new HttpLink({
  uri: "http://localhost:4000/"
});

const typeDefs = gql`
  extend type Rocket {
    description: String!
  }
`;

// 1. define a method which resolves the `description` field:
const resolvers = {
  Rocket: {
    description: () => "A boilerplate standard space rocket"
  }
};

// 2. pass the client resolvers to Apollo Client:
const client = new ApolloClient({
  cache,
  link,
  typeDefs,
  resolvers
});
```

Now that we have a basic resolver, we might find that during testing it's a bit boring to show the same boilerplate text every time. In fact we might want to test different lengths of text to make sure our layout still looks good. Introducing a mock data helper library such as [faker.js](https://github.com/marak/Faker.js/) can help keep the mock data varied while testing. We can incorporate it easily into this workflow:

```js
import faker from "faker/locale/en";

// returns either 1 or 2 latin sentences, like
// 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...
const oneOrTwoSentences = () =>
  faker.lorem.sentences(Math.random() < 0.5 ? 1 : 2);

const resolvers = {
  Rocket: {
    description: () => oneOrTwoSentences()
  }
};
```

> _Note:_ the faker.js library comes bundled with lots and lots of strings that can consume precious bundle bytes. For this reason you should make sure to only include the faker.js dependency in development mode and take care not to include this in your production bundle.

## 3. Query the mocked field with the @client directive.

Now, you’re ready to query your new field inside the `RocketDetails` component. Just add your new field to the query and specify the `@client` directive, and start using it in your UI.

```js
const GET_ROCKET_DETAILS = gql`
  query RocketDetails($rocketId: ID!) {
    rocket(id: $rocketId) {
      type
+++   description @client
    }
  }
`;

export default function RocketDetails({ rocketId }) {
  return (
    <Query query={GET_ROCKET_DETAILS} variables={{ rocketId }}>
      {({ data, loading, error }) => {
        if (loading) return <Loading />;
        if (error) return <p>ERROR: {error.message}</p>;

        return (
          <div>
            <p>Rocket Type: {data.rocket.type}</p>
            <p>Description: {data.rocket.description}</p>
          </div>
        );
      }}
    </Query>
  );
}
```

## 4. Toggle on “real” data.

Once the feature is ready on the backend, just remove the @client directive from your query. You should now be able to see your real production data returned instead.

```js
const GET_ROCKET_DETAILS = gql`
  query RocketDetails($rocketId: ID!) {
    rocket(id: $rocketId) {
      type
---   description @client
+++   description
    }
  }
`;
```

There you have it, a workflow for developing new features with new schema fields ahead of the actual schema implementation. If you have feedback on this workflow, experiences you want to share, or just want to join the general discussion on client-side development and mocking, join us on [Spectrum](https://spectrum.chat/apollo)!
