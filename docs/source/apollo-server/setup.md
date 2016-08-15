---
title: Setup
order: 302
description: How to set up Apollo Server
---

Apollo Server exports `apolloExpress`, `apolloConnect`, `ApolloHAPI` and `apolloKoa` which can be used as a drop-in to turn your Express, Connect, HAPI or Koa server into a GraphQL server.


<h2 id="apolloOptions">ApolloOptions</h2>

Apollo Server accepts an ApolloOptions object as its single argument. An ApolloOptions object has the following properties:

```js
// options object
const ApolloOptions = {
  schema: GraphQLSchema,
  context?: any, // value to be used as context in resolvers
  rootValue?: any,
  formatError?: Function, // function used to format errors before returning them to clients
  validationRules?: Array<ValidationRule>, // additional validation rules to be applied to client-specified queries
  formatParams?: Function, // function applied for each query in a batch to format parameters before passing them to `runQuery`
  formatResponse?: Function, // function applied to each response before returning data to clients
})
```


Alternatively, Apollo Server accepts a function which takes the request as input and returns an ApolloOptions object (or a promise for one):

```js

// example options function (for express)
apolloExpress(request => ({
  schema: typeDefinitionArray,
  context: { user: request.session.user }
}))
```

<h2 id="apolloExpress">Using with Express</h2>

The following code snippet shows how to use Apollo Server with Express:

```js
import express from 'express';
import { apolloExpress } from 'apollo-server';

const PORT = 3000;

var app = express();

app.use('/graphql', bodyParser.json(), apolloExpress({ schema: myGraphQLSchema }));

app.listen(PORT);
```

<h2 id="apolloConnect">Using with Connect</h2>

The following code snippet shows how to use Apollo Server with Connect:

```js
import connect from 'express';
import { apolloConnect } from 'apollo-server';

const PORT = 3000;

var app = connect();

app.use('/graphql', bodyParser.json(), apolloConnect({ schema: myGraphQLSchema }));

app.listen(PORT);
```

The `options` passed to `apolloConnect` are the same as those passed to `apolloExpress`.


<h2 id="apolloHAPI">Using with HAPI</h2>

The following code snippet shows how to use Apollo Server with HAPI:

```js
import Hapi from 'hapi';
import { ApolloHAPI } from 'apollo-server';

const server = new Hapi.Server();

const HOST = 'localhost';
const PORT = 3000;

server.connection({
    host: HOST,
    port: PORT,
});

server.register({
    register: new ApolloHAPI(),
    options: { schema: myGraphQLSchema },
    // or options: request => ({ schema, ... })
    routes: { prefix: '/graphql' },
});
```


<h2 id="apolloKoa">Using with Koa</h2>

The following code snippet shows how to use Apollo Server with Koa:

```js
import koa from 'koa';
import koaRouter from 'koa-router';
import { apolloKoa } from 'apollo-server';

const app = new koa();
const router = new koaRouter();
const PORT = 3000;

app.use(koaBody());

router.post('/graphql', apolloKoa({ schema: myGraphQLSchema }));
app.use(router.routes());
app.use(router.allowedMethods());
app.listen(PORT);
```
