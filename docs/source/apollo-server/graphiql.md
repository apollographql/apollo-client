---
title: GraphiQL
order: 304
description: How to set up GraphiQL with Apollo Server
---

Apollo Server allows you to easily use [GraphiQL](https://github.com/graphql/graphiql). Here's how:

<h2 id="graphiqlOptions">Configuring GraphiQL</h2>

`graphiql<Express/Connect/HAPI/Koa>` accepts the following options object:

```js
const options = {
  endpointUrl: String, // URL for the GraphQL endpoint this instance of GraphiQL serves
  query?: String, // optional query to pre-populate the GraphiQL UI with
  operationName?: String, // optional operationName to pre-populate the GraphiQL UI with
  variables?: Object, // optional variables to pre-populate the GraphiQL UI with
  result?: Object, // optional result to pre-populate the GraphiQL UI with
}
```

Apollo Server's `graphiql` middleware does not run any query passed to it, it simply renders it in the UI.
To actually execute the query, the user must submit it via the GraphiQL UI, which will
send the request to the GraphQL endpoint specified with `endpointURL`.

<h2 id="graphiqlExpress">Using with Express</h2>

If you are using Express, GraphiQL can be configured as follows:

```js
import { graphiqlExpress } from 'apollo-server';

app.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
}));
```


<h2 id="graphiqlConnect">Using with Connect</h2>

If you are using Connect, GraphiQL can be configured as follows:

```js
import { graphiqlConnect } from 'apollo-server';

app.use('/graphiql', graphiqlConnect({
  endpointURL: '/graphql',
}));
```


<h2 id="graphiqlHAPI">Using with HAPI</h2>

If you are using HAPI, GraphiQL can be configured as follows:

```js
import { GraphiQLHAPI } from 'apollo-server';

server.register({
    register: new GraphiQLHAPI(),
    options: { endpointURL: '/graphql' },
    routes: { prefix: '/graphiql' },
});
```


<h2 id="graphiqlKoa">Using with Koa</h2>

If you are using Koa, GraphiQL can be configured as follows:

```js
import { graphiqlKoa } from 'apollo-server';

router.get('/graphiql', graphiqlKoa({ endpointURL: '/graphql' }));
```
