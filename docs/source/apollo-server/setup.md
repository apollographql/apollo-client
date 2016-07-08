---
title: Setup
order: 302
description: How to set up Apollo Server
---

Apollo Server exports `apolloExpress`, which can be used as a drop-in Express middleware to turn your server into a GraphQL server.

<h2 id="apolloServer">ApolloExpress(options)</h2>

```js
import { apolloExpress } from 'apollo-server';

var app = express();

app.use('/graphql', bodyParser.json(), apolloExpress({ schema: myGraphQLSchema}));
```

The `options` may be either:
- an ApolloOptions object object with the parameters specified below
- a function that, given an Express [`request`](http://expressjs.com/en/4x/api.html#req), returns an ApolloOptions object
- a function that, given an Express [`request`](http://expressjs.com/en/4x/api.html#req), returns a promise for an ApolloOptions object

```js
// options object
apolloExpress({
  schema: GraphQLSchema,
  context?: any, // value to be used as context in resolvers
  rootValue?: any,
  formatError?: Function, // function used to format errors before returning them to clients
  validationRules?: Array<ValidationRule>, // additional validation rules to be applied to client-specified queries
  logFunction?: Function, // function called for logging errors and info
  formatParams?: Function, // function applied for each query in a batch to format parameters before passing them to `runQuery`
  formatResponse?: Function, // function applied to each response before returning data to clients
})

// example options function
apolloExpress(request => ({
  schema: typeDefinitionArray,
  context: { user: request.session.user }
}))
```

<h2 id="sendingRequests">Sending Requests</h2>

ApolloExpress accepts only JSON-encoded POST requests. A valid request must contain eiter a `query` or an `operationName`, and may include `variables.` For example:

```js
{
  "query": "query aTest{ test(who: $arg1) }",
  "operationName": "aTest",
  "variables": { "arg1": "me" }
}
```

Variables can be an object or a JSON-encoded string. I.e. the following is equivalent to the previous query:

```js
{
  "query": "query aTest{ test(who: $arg1) }",
  "operationName": "aTest",
  "variables": "{ \"arg1\": \"me\" }"
}
```

A batch of queries can be sent by simply sending a JSON-encoded array of queries, e.g.

```js
[
  { "query": "{ testString }" },
  { "query": "query q2{ test(who: \"you\" ) }" }
]
```

If a batch of queries is sent, the response will be an array of GraphQL responses.

<h2 id="corsSupport">CORS support</h2>

If Apollo Server runs under a different origin than the frontend app, then CORS support must be configured on the server. For example, if apollo server is running under `graphql.example.com` and the website is served from `www.example.com`, CORS needs to be configured in the express app. [CORS](https://github.com/expressjs/cors) is a node.js package for providing a Connect/Express middleware that can be used to enable CORS with various options.

```javascript
import { apolloExpress } from 'apollo-server';
import cors from 'cors';

var app = express().use('*', cors());;
```

Ensure you have npm installed cors. The * value allows access from any third-party site. It should probably be updated to reflect your specific environment. Simple usage details to [Enable All CORS Requests](https://github.com/expressjs/cors#simple-usage-enable-all-cors-requests) More complex configuration options are available including the ability to [Enable CORS for a Single Route](https://github.com/expressjs/cors#enable-cors-for-a-single-route).

The information contained in the apolloClient re: CORS configuration did not effect on the server.

<h2 id="auth-tokens">Authentication Tokens</h2>

Authentication tokens sent from the client can be retrieved, processed, and then passed into context to be accessed by resolvers like so:
```javascript
app.use('/graphql', apolloExpress(async (req) => {
  // Retrieve token from authorization header and lookup user in DB
  const user = await models.mongoose.users.fromToken(req.headers.authorization);

  return {
    context: {
      // Attach user data to context
      user,
    }
  }
}));
// ...
```
