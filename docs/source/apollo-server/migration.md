---
title: Migrating from v0.1
order: 305
description: How to migrate from an older version of Apollo Server
---

Version 0.2.0 of Apollo Server contains several breaking changes in the API.
The most notable changes are:

- the `apolloServer` function no longer exists and was replaced with `apolloExpress`.
- `apolloExpress` no longer accepts shorthand type definitions
- `apolloExpress` doesn't have the `resolvers`, `mocks` and `connectors` options.
- `apolloExpress` doesn't include GraphiQL any more
- Apollo Server no longer accepts GET requests or parameters in the URL
- `apolloExpress` no longer parses the HTTP body automatically


In order to make updating from an older version of Apollo Server easier, this guide
shows how to use `graphql-tools` together with `apolloExpress` and `graphiqlExpress` to
replace `apolloServer`.

The three main differences between the old and the new approach are:
1. generating the schema is now done with `graphql-tools`, Apollo Server only uses the finished schema.
2. `bodyParser` has to be used to parse requests before passing them to `expressApollo`
3. GraphiQL now has to be served on a separate path

The following code snippet in Apollo Server 0.1.x

```js
import express from 'express';
import { apolloServer } from 'apollo-server';
import Schema from './data/schema';
import Mocks from './data/mocks';
import Resolvers from './data/resolvers';
import Connectors from './data/connectors';

const GRAPHQL_PORT = 8080;

const graphQLServer = express();

graphQLServer.use('/graphql', apolloServer({
  graphiql: true,
  schema: Schema,
  resolvers: Resolvers,
  connectors: Connectors,
  mocks: Mocks,
}));

graphQLServer.listen(GRAPHQL_PORT, () => console.log(
  `GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}/graphql`
));
```

... should be written as follows in Apollo Server 0.2.x and above:


```js
import express from 'express';

import Schema from './data/schema';
import Mocks from './data/mocks';
import Resolvers from './data/resolvers';
import Connectors from './data/connectors';

// NEW or changed imports:
import { apolloExpress, graphiqlExpress } from 'apollo-server';
import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';
import bodyParser from 'body-parser';



const GRAPHQL_PORT = 8080;

const graphQLServer = express();

const executableSchema = makeExecutableSchema({
  typeDefs: Schema,
  resolvers: Resolvers,
  connectors: Connectors,
});

addMockFunctionsToSchema({
  schema: executableSchema,
  mocks: Mocks,
  preserveResolvers: true,
});

graphQLServer.use('/graphql', bodyParser.json(), apolloExpress({
  schema: executableSchema,
}));

graphQLServer.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
}));

graphQLServer.listen(GRAPHQL_PORT, () => console.log(
  `GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}/graphql`
));
```
