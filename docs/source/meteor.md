---
title: Meteor
order: 152
description: Specifics about using Apollo in your Meteor application.
---

The Apollo client and server tools are published on Npm, which makes them available to all JavaScript applications, including those written with [Meteor](https://www.meteor.com/) 1.3 and above. When using Meteor with Apollo, you can use those npm packages directly, or you can use the [`apollo` Atmosphere package](https://github.com/apollostack/meteor-integration/), which simplifies things for you.

To install `apollo`, run these commands:

```text
meteor add apollo
meteor npm install --save apollo-client graphql-server-express express graphql graphql-tools body-parser
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

Create the following files:

```bash
/imports/api/schema.js         # a JavaScript file with the schema
/imports/api/resolvers.js      # a JavaScript file with the Apollo resolvers
```

Define a simple [`schema`](http://dev.apollodata.com/tools/graphql-tools/generate-schema.html) under schema.js.

```js

export const typeDefs = `
type Query {
  say: String
}

schema {
  query: Query
}
`;
```

Define your first [`resolver`](http://dev.apollodata.com/tools/graphql-tools/resolvers.html) under resolvers.js.

```js
export const resolvers = {
  Query: {
    say(root, args, context) {
      return 'hello world';
    }
  }
}
```

Set up the Apollo server with [`createApolloServer`](#createApolloServer):

```js
import { createApolloServer } from 'meteor/apollo';
import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';

import { typeDefs } from '/imports/api/schema';
import { resolvers } from '/imports/api/resolvers';

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

createApolloServer({
  schema,
});
```

The [GraphiQL](https://github.com/graphql/graphiql) url by default is [http://localhost:3000/graphiql](http://localhost:3000/graphiql). You can now test your first query:

```js
{
  say
}
```



Inside your resolvers, if the user is logged in, their id will be `context.userId` and their user doc will be `context.user`:

```js
export const resolvers = {
  Query: {
    user(root, args, context) {
      // Only return the current user, for security
      if (context.userId === args.id) {
        return context.user;
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
- `opts`: [`FetchOptions`](https://github.github.io/fetch#options) passed to the [`NetworkInterface`](http://dev.apollodata.com/core/network.html#createNetworkInterface). Default: `{}`.
- `useMeteorAccounts`: Whether to send the current user's login token to the GraphQL server with each request. Default: `true`.
- `cookieLoginToken`: if `useMeteorAccounts` is `true`, pass a potential login token stored in the cookies by a third-party package, such as [`meteorhacks:fast-render`](https://github.com/kadirahq/fast-render), to allow access to `context.userId` & `context.user` in the resolvers functions run during server-side rendering. 
- `batchingInterface`: use a [`BatchedNetworkInterface`](http://dev.apollodata.com/core/network.html#query-batching) instead of [`NetworkInterface`](http://dev.apollodata.com/core/network.html#network-interfaces). Default: `true`.
- `batchInterval`: if the `batchingInterface` field is `true`, this field defines the batch interval to determine how long the network interface batches up queries before sending them to the server. Default: `10`.

Returns an [`options` object](http://dev.apollodata.com/core/apollo-client-api.html#apollo-client) for `ApolloClient`:

```
{
  ssrMode: Meteor.isServer, // true if you use it server-side, false client-side
  networkInterface,
  dataIdFromObject: object.__typename + object._id
}
```

### createApolloServer

`createApolloServer(options, config)`

- `options`: [Apollo Server `options`](http://dev.apollodata.com/tools/apollo-server/setup.html#apolloOptions)
- `config` may contain any of the following fields:
  - `path`: [Path](http://expressjs.com/en/api.html#app.use) of the GraphQL server. Default: `'/graphql'`.
  - `configServer`: Function that is given the express server for further configuration. For example: `{configServer: expressServer => expressServer.use(cors())}`
  - `maxAccountsCacheSizeInMB`: User account ids are cached in memory to reduce the response latency on multiple requests from the same user. Default: `1`.
  - `graphiql`: Whether to enable GraphiQL. Default: `true` in development and `false` in production.
  - `graphiqlPath`: Path for GraphiQL. Default: `/graphiql` (note the i).
  - `graphiqlOptions`: [GraphiQL options](http://dev.apollodata.com/tools/apollo-server/graphiql.html#graphiqlOptions) (optional).



It will use the same port as your Meteor server. Don't put a route or static asset at the same path as the Apollo route or the GraphiQL route if in use (defaults are `/graphql` and `/graphiql` respectively).

## Accounts

You may still use the authentication based on DDP (Meteor's default data layer) and apollo will send the current user's login token to the GraphQL server with each request. 

If you want to use only GraphQL in your app you can use [nicolaslopezj:apollo-accounts](https://github.com/nicolaslopezj/meteor-apollo-accounts). This package uses the Meteor Accounts methods in GraphQL, it's compatible with the accounts you have saved in your database and you may use apollo-accounts and Meteor's DDP accounts at the same time.

If you are relying on the current user in your queries, you'll want to [clear the store when the current user state changes](http://dev.apollodata.com/react/auth.html#login-logout). To do so, use `client.resetStore()` in the `Meteor.logout` callback:

```
// The `client` variable refers to your `ApolloClient` instance.
// It would be imported in your template,
// or passed via props thanks to `withApollo` in React for example.

Meteor.logout(function() {
  return client.resetStore(); // make all active queries re-run when the log-out process completed
});
```

## SSR
There are two additional configurations that you need to keep in mind when using [React Server Side Rendering](http://dev.apollodata.com/react/server-side-rendering.html) with Meteor.
1. Connect your express server to Meteor's existing server with [WebApp.connectHandlers.use](https://docs.meteor.com/packages/webapp.html)
2. Do not end the connection with `res.send()` and `res.end()` use `req.dynamicBody` and `req.dynamicHead` instead and call `next()`. [more info](https://github.com/meteor/meteor/pull/3860)

The idea is that you need to let Meteor to finally render the html you can just provide it extra `body` and or `head` for the html and Meteor will append it, otherwise CSS/JS and or other merged html content that Meteor serve by default (including your application main .js file) will be missing.

Here is a full working example:
```js
import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { meteorClientConfig } from 'meteor/apollo';
import React from 'react';
import ReactDOM from 'react-dom/server';
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import { createStore, combineReducers, applyMiddleware, compose } from 'redux';
import { ApolloProvider } from 'react-apollo';
import { renderToStringWithData } from 'react-apollo';
import { match, RouterContext } from 'react-router';
import Express from 'express';
import 'isomorphic-fetch';
import Helmet from 'react-helmet';

import routes from '../both/routes';
import rootReducer from '../../ui/reducers';
import Body from '../both/routes/body';

// 1# do not use new
const app = Express();

app.use((req, res, next) => {
  match({ routes, location: req.originalUrl }, (error, redirectLocation, renderProps) => {
    if (redirectLocation) {
      res.redirect(redirectLocation.pathname + redirectLocation.search);
    } else if (error) {
      console.error('ROUTER ERROR:', error); // eslint-disable-line no-console
      res.status(500);
    } else if (renderProps) {
      const networkInterfaceConfig = meteorClientConfig({
        opts: {
          credentials: 'same-origin',
          headers: req.headers,
        },
      });
      
      const client = new ApolloClient(networkInterfaceConfig);

      const store = createStore(
        combineReducers({
          ...rootReducer,
          apollo: client.reducer(),
        }),
        {}, // initial state
        compose(
          applyMiddleware(client.middleware())
        )
      );

      const component = (
        <ApolloProvider store={store} client={client}>
          <RouterContext {...renderProps} />
        </ApolloProvider>
      );

      renderToStringWithData(component).then((content) => {
        const initialState = client.store.getState()[client.reduxRootKey].data;
        // the body content we want to append
        const body = <Body content={content} state={initialState} />;
        // #2 `req.dynamicBody` will hold that body and meteor will take care of
        // actually appending it to the end result
        req.dynamicBody = ReactDOM.renderToStaticMarkup(body);
        const head = Helmet.rewind();
        // #2 `req.dynamicHead` in this case we use `react-helmet` to add seo tags
        req.dynamicHead = `  ${head.title.toString()}
  ${head.meta.toString()}
  ${head.link.toString()}
`;
        // #2 Important we do not want to return this, we just let meteor handle it
        next();
      });
    } else {
      console.log('not found');
    }
  });
});
// #1 connect your express server with meteor's
WebApp.connectHandlers.use(Meteor.bindEnvironment(app));
```

## Apollo Optics

Here's a minimal example of [Apollo Optics](http://www.apollodata.com/optics) integration:

```js
import { createApolloServer } from 'meteor/apollo';
import OpticsAgent from 'optics-agent';

import executableSchema from 'schema.js';

OpticsAgent.instrumentSchema(executableSchema);

createApolloServer(req => ({
  schema: executableSchema,
  context: {
    opticsContext: OpticsAgent.context(req),
  },
}), {
  configServer: (graphQLServer) => {
    graphQLServer.use('/graphql', OpticsAgent.middleware());
  },
});
```
