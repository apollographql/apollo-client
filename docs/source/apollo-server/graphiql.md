---
title: GraphiQL
order: 303
description: How to set up GraphiQL with Apollo Server
---

Apollo Server allows you to easily use [GraphiQL](https://github.com/graphql/graphiql). If you are using Express, it can be configured as follows:

```js
import { graphiqlExpress } from 'apollo-server';

app.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
}));
```

`graphiqlExpress` accepts the following arguments:

```js
graphiqlExpress({
  endpointUrl: String, // URL for the GraphQL endpoint this instance of GraphiQL serves
  query?: String, // optional query to pre-populate the GraphiQL UI with
  operationName?: String, // optional operationName to pre-populate the GraphiQL UI with
  variables?: Object, // optional variables to pre-populate the GraphiQL UI with
  result?: Object, // optional result to pre-populate the GraphiQL UI with
})
```

`graphiqlExpress` does not run any query passed to it, it simply renders it in the UI.
To actually execute the query, the user must submit it via the GraphiQL UI, which will
send the request to the GraphQL endpoint specified with `endpointURL`.
