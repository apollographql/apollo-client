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

Define your schema and resolvers, and then set up the Apollo server with [`createApolloServer`](#createApolloServer):

```js
import { createApolloServer } from 'meteor/apollo';
import { makeExecutableSchema, addMockFunctionsToSchema } from 'graphql-tools';

import typeDefs from '/imports/api/schema';
import resolvers from '/imports/api/resolvers';

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

createApolloServer({
  schema,
});
```

The [GraphiQL](https://github.com/graphql/graphiql) url by default is [http://localhost:3000/graphiql](http://localhost:3000/graphiql)

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
- `options`: `FetchOptions` passed to [`createNetworkInterface`](http://dev.apollodata.com/core/apollo-client-api.html#createNetworkInterface). Default: `{}`.
- `useMeteorAccounts`: Whether to send the current user's login token to the GraphQL server with each request. Default: `true`.

Returns an [`options` object](http://dev.apollodata.com/core/apollo-client-api.html#apollo-client) for `ApolloClient`:

```
{
  networkInterface
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

You may still use the authentication based on DDP (Meteor's default data layer) and apollo will send the current user's login token to the GraphQL server with each request. But if you want to use only GraphQL in your app you can use [nicolaslopezj:apollo-accounts](https://github.com/nicolaslopezj/meteor-apollo-accounts). This package uses the Meteor Accounts methods in GraphQL, it's compatible with the accounts you have saved in your database and you may use apollo-accounts and Meteor's DDP accounts at the same time.


## SSR
There are two additional configurations that you need to keep in mind when using [React Server Side Rendering](http://dev.apollodata.com/react/server-side-rendering.html) with Meteor.
1. Connect your express server to Meteor's existing server with [WebApp.connectHandlers.use](https://docs.meteor.com/packages/webapp.html)
2. Do not end the connection with `res.send()` and `res.end()` use `req.dynamicBody` and `req.dynamicHead` instead and call `next()`. [more info](https://github.com/meteor/meteor/pull/3860)

The idea is that you need to let Meteor to finally render the html you can just provide it extra `body` and or `head` for the html and Meteor will append it, otherwise CSS/JS and or other merged html content that Meteor serve by default (including your application main .js file) will be missing.

Here is a full working example:
```js
import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
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
      const client = new ApolloClient({
        ssrMode: true,
        // networkInterface: createLocalInterface(graphql, schema),
        networkInterface: createNetworkInterface({
          uri: Meteor.absoluteUrl('/graphql'),
          opts: {
            credentials: 'same-origin',
            headers: req.headers,
          },
        }),
      });

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
