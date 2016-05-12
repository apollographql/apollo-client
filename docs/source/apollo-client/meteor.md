---
title: Meteor integration
order: 112
description: Specifics about using Apollo in your Meteor application.
---

The Apollo client and server tools are published on NPM, which makes them available to all JavaScript applications, including those written with Meteor 1.3 and above. When using Meteor with Apollo, there are a few things to keep in mind to have a smooth integration between the client and server.

You can see all of these in action in the [Apollo Meteor starter kit](https://github.com/apollostack/meteor-starter-kit).

## Client

### Using with Meteor Accounts

The only thing you need to do on the client to pass through your Meteor login token into the Apollo server is to create a network interface with a header that passes the login token you can get from the Meteor Accounts client. Then just log in as normal and requests sent after that point will be authenticated.

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import { Accounts } from 'meteor/accounts-base';

const networkInterface = createNetworkInterface('/graphql');

networkInterface.use([{
  applyMiddleware(request, next) {
    const currentUserToken = Accounts._storedLoginToken();

    if (!currentUserToken) {
      next();
      return;
    }

    if (!request.options.headers) {
      request.options.headers = new Headers();
    }

    request.options.headers.Authorization = currentUserToken;

    next();
  }
}]);

const client = new ApolloClient({
  networkInterface,
});
```

## Server

### Using Express with WebApp

The Apollo server, and the Express GraphQL package that it is based on, rely on the Express server-side API framework. To use it, you will need to initialize a new Express server and proxy it to your Meteor `WebApp` server.

```js
import { apolloServer } from 'graphql-tools';
import express from 'express';
import proxyMiddleware from 'http-proxy-middleware';
import { WebApp } from 'meteor/webapp';

import { schema, resolvers } from '/imports/api/schema';

const GRAPHQL_PORT = 4000;

const graphQLServer = express();

graphQLServer.use('/graphql', apolloServer({
  graphiql: true,
  pretty: true,
  schema,
  resolvers,
}));

graphQLServer.listen(GRAPHQL_PORT, () => console.log(
  `GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}`
));

// This redirects all requests to /graphql to our Express GraphQL server
WebApp.rawConnectHandlers.use(proxyMiddleware(`http://localhost:${GRAPHQL_PORT}/graphql`));
```

### Getting the current user

If you are passing in the login token from the client as detailed above, you probably want to get the current user on the server, and use that in your resolvers. To do so, you should make your `apolloServer` options a function of the current request, and use some Meteor packages to get the user from the login token.

```js
// Some more imports
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { check } from 'meteor/check';

// ... same setup code as above

graphQLServer.use('/graphql', apolloServer(async (req) => {
  let user = null;

  // Get the token from the header
  if (req.headers.authorization) {
    const token = req.headers.authorization;
    check(token, String);
    const hashedToken = Accounts._hashLoginToken(token);

    // Get the user from the database
    user = await Meteor.users.findOne(
      {"services.resume.loginTokens.hashedToken": hashedToken});
  }

  return {
    graphiql: true,
    pretty: true,
    schema,
    resolvers,

    // Attach the user to the context object
    context: {
      // The current user will now be available on context.user in all resolvers
      user,
    },
  };
}));
```

Now, you can use `context.user` from your resolvers:

```js
user(root, args, context) {
  // Only return data if the fetched id matches the current user, for security
  if (context.user._id === args.id) {
    return context.user;
  }
}
```
