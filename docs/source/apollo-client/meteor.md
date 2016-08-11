---
title: Meteor integration
order: 152
description: Specifics about using Apollo in your Meteor application.
---

The Apollo client and server tools are published on NPM, which makes them available to all JavaScript applications, including those written with [Meteor](https://www.meteor.com/) 1.3 and above. When using Meteor with Apollo, you can use those npm packages directly, or you can use the [`apollo` Atmosphere package](https://github.com/apollostack/meteor-integration/), which simplifies things for you.

To install `apollo`, run both of these commands:

```text
meteor add apollo
meteor npm install --save apollo-client apollo-server express graphql
```

## Usage

You can see this package in action in the [Apollo Meteor starter kit](https://github.com/apollostack/meteor-starter-kit).

### Client

Connect to the Apollo server with [`meteorClientConfig`](#meteorClientConfig):

```js
import ApolloClient from 'apollo-client';
import { meteorClientConfig } from 'meteor/apollo';

const client = new ApolloClient(meteorClientConfig());
```

### Server

Define your schema and resolvers, and then set up the Apollo server with [`createApolloServer`](#createApolloServer):

```js
import { createApolloServer } from 'meteor/apollo';

import schema from '/imports/api/schema';
import resolvers from '/imports/api/resolvers';

createApolloServer({
  graphiql: true,
  pretty: true,
  schema,
  resolvers,
});
```

The [GraphiQL](https://github.com/graphql/graphiql) url is [http://localhost:3000/graphql](http://localhost:3000/graphql)

Inside your resolvers, if the user is logged in, their id will be  `context.userId`:

```js
export const resolvers = {
  Query: {
    async user(root, args, context) {
      // Only return the current user, for security
      if (context.userId === args.id) {
        return await Meteor.users.findOne(context.userId);
      }
    },
  },
  User: ...
}
```

## API

### meteorClientConfig

`meteorClientConfig(networkInterfaceConfig)`

`networkInterfaceConfig` may contain any of the following fields:
- `path`: path of the GraphQL server. Default: `'/graphql'`.
- `options`: `FetchOptions` passed to [`createNetworkInterface`](http://docs.apollostack.com/apollo-client/index.html#createNetworkInterface). Default: `{}`.
- `useMeteorAccounts`: Whether to send the current user's login token to the GraphQL server with each request. Default: `true`.

Returns an [`options` object](http://0.0.0.0:4000/apollo-client/index.html#ApolloClient) for `ApolloClient`:

```
{
  networkInterface
  queryTransformer: addTypenameToSelectionSet
  dataIdFromObject: object.__typename + object._id
}
```

### createApolloServer

`createApolloServer(options, config)`

- [`options`](http://docs.apollostack.com/apollo-server/tools.html#apolloServer)
- `config` may contain any of the following fields:
  - `path`: [Path](http://expressjs.com/en/api.html#app.use) of the GraphQL server. Default: `'/graphql'`.
  - `maxAccountsCacheSizeInMB`: User account ids are cached in memory to reduce the response latency on multiple requests from the same user. Default: `1`.

It will use the same port as your Meteor server. Don't put a route or static asset at the same path as the Apollo server (default is `/graphql`).
