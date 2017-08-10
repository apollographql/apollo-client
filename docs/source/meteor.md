---
title: Meteor
order: 152
description: Specifics about using Apollo in your Meteor application.
---

The Apollo client and server tools are published on npm, which makes them available to all JavaScript applications, including those written with [Meteor](https://www.meteor.com/) 1.3 and above. When using Meteor with Apollo, you can use those npm packages directly, or you can use the [`apollo` Atmosphere package](https://github.com/apollostack/meteor-integration/), which simplifies things for you.

To install `apollo`, run these commands:

```text
meteor add apollo
meteor npm install --save apollo-client graphql-server-express express graphql graphql-tools body-parser
```

## Usage

### Examples

You can see this package in action in the [Apollo Meteor starter kit](https://github.com/apollostack/meteor-starter-kit). 

If you'd like to understand how this simple package works internally, you are invited to [take the code tour](https://www.codetours.xyz/tour/xavcz/meteor-apollo-codetour).

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

Define a simple [schema](http://dev.apollodata.com/tools/graphql-tools/generate-schema.html) under `schema.js`.

```js

export const typeDefs = `
type Query {
  say: String
}
`;
```

Define your first [resolver](http://dev.apollodata.com/tools/graphql-tools/resolvers.html) under `resolvers.js`.

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

### Query batching

`meteor/apollo` gives you a `BatchedNetworkInterface` by default thanks to `createMeteorNetworkInterface`. This interface is meant to reduce significantly the number of requests sent to the server.

In order to get the most out of it, you can attach a `dataloader` to every request to batch loading your queries (and cache them!).

Here are some great resources to help you integrating query batching in your Meteor application:
- About batched network interface:
  - [Apollo Client documentation](http://dev.apollodata.com/tools/graphql-tools/connectors.html#DataLoader-and-caching), the official documentation explaining how it works and how to set it up.
  - [Query batching in Apollo](https://dev-blog.apollodata.com/query-batching-in-apollo-63acfd859862), an article from the Apollo blog with more in depth explanation.
- About Dataloader:
  - Apollo's [Graphql server documentation](http://dev.apollodata.com/tools/graphql-tools/connectors.html#DataLoader-and-caching), get to know how to setup `dataloader` in your server-side implementation.
  - [Dataloader repository](https://github.com/facebook/dataloader), a detailed explanation of batching & caching processes, plus a bonus of a 30-minute source code walkthrough video.

### Deployment

It is _strongly_ recommended to explictly specify the `ROOT_URL` environment variable of your deployment. The configuration of the Apollo client and GraphQL server provided by this package depends on a configured `ROOT_URL`. Read more about that in the [Meteor Guide](https://guide.meteor.com/deployment.html#custom-deployment).

### Typings

Your Meteor apps may rely on static typings with TypeScript. If so, it is recommended to use the [ambient TypeScript definition for this Atmosphere package](https://github.com/KeithGillette/Apollo-GraphQL-Meteor-Integration-Typings).

## API

### meteorClientConfig

`meteorClientConfig(customClientConfig = {})`

The `customClientConfig` is an optional object that can have any [Apollo Client options](http://dev.apollodata.com/core/apollo-client-api.html#ApolloClient.constructor).

Defining a `customClientConfig` object extends or replaces fields of the default configuration provided by the package. 

The default configuration of the client is:
- `networkInterface`: `createMeteorNetworkInterface()`, a pre-configured network interface. See below for more information.
- `ssrMode`: `Meteor.isServer`, enable server-side rendering mode by default if used server-side.

The store is normalized by default with `__typename` + `_id` identifiers. See [store normalization](http://dev.apollodata.com/core/how-it-works.html#normalize) section for more information.

### createMeteorNetworkInterface

`createMeteorNetworkInterface(customNetworkInterface = {})`

`customNetworkInterface` is an optional object that replaces fields of the default configuration:
- `uri`: `Meteor.absoluteUrl('graphql')`, points to the default GraphQL server endpoint, such as http://locahost:3000/graphql or https://www.my-app.com/graphql.
- `opts`: `{}`, additional [`FetchOptions`](https://github.github.io/fetch#options) passed to the [`NetworkInterface`](http://dev.apollodata.com/core/network.html#createNetworkInterface).
- `useMeteorAccounts`: `true`, enable the Meteor User Accounts middleware to identify the user with every request thanks to her login token.
- `batchingInterface`: `true`, use a [`BatchedNetworkInterface`](http://dev.apollodata.com/core/network.html#query-batching) by default instead of [`NetworkInterface`](http://dev.apollodata.com/core/network.html#network-interfaces).
- `batchInterval`: `10`, if the `batchingInterface` field is `true`, this field defines the batch interval to determine how long the network interface batches up queries before sending them to the server.

Additionally, if the `useMeteorAccounts` is set to `true`, you can add to your `customNetworkInterface` a `loginToken` field while doing [server-side rendering](http://dev.apollodata.com/core/meteor.html#SSR) to handle the current user.

`createMeteorNetworkInterface` example:

```js
import ApolloClient from 'apollo-client'
import { createMeteorNetworkInterface, meteorClientConfig } from 'meteor/apollo';

const networkInterface = createMeteorNetworkInterface({
  // use a batched network interface instead of a classic network interface
  batchingInterface: true, 
});

const client = new ApolloClient(meteorClientConfig({ networkInterface }));
```

### createApolloServer

`createApolloServer(customOptions = {}, customConfig = {})`

`createApolloServer` is used to create and configure an Express GraphQL server.

`customOptions` is an object that can have any [GraphQL Server `options`](http://dev.apollodata.com/tools/graphql-server/setup.html#graphqlOptions), used to enhance the GraphQL server run thanks to [`graphqlExpress`](http://dev.apollodata.com/tools/graphql-server/setup.html#graphqlExpress). Defining a `customOptions` object extends or replaces fields of the default configuration provided by the package:

- `context`: `{}` is an object or a function returning an object that extends the context object being passed down to the resolvers.
- `formatError`: a function used to format errors before returning them to clients.
- `debug`: `Meteor.isDevelopment`, additional debug logging if execution errors occur in dev mode.

*This is the object that should have a `schema` entry created by [`makeExecutableSchema`](http://dev.apollodata.com/core/meteor.html#Server).*

`customConfig` is an optional object that can be used to replace the configuration of how the Express server itself runs: 

- `path`: [path](http://expressjs.com/en/api.html#app.use) of the GraphQL server. This is the endpoint where the queries & mutations are sent. Default: `/graphql`.
- `configServer`: a function that is given to the express server for further configuration. You can for instance enable CORS with `createApolloServer({}, {configServer: expressServer => expressServer.use(cors())})`
- `graphiql`: whether to enable [GraphiQL](https://github.com/graphql/graphiql). Default: `true` in development and `false` in production.
- `graphiqlPath`: path for GraphiQL. Default: `/graphiql` (note the _i_).
- `graphiqlOptions`: [GraphiQL options](http://dev.apollodata.com/tools/apollo-server/graphiql.html#graphiqlOptions) Default: attempts to use `Meteor.loginToken` from localStorage to log you in.

It will use the same port as your Meteor server. Don't put a route or static asset at the same path as the GraphQL route or the GraphiQL route if in use (again, defaults are `/graphql` and `/graphiql` respectively).

## Accounts

You may still use the authentication based on DDP (Meteor's default data layer) and `apollo` will send the current user's login token to the GraphQL server with each request. 

If you want to use only GraphQL in your app you can use [nicolaslopezj:apollo-accounts](https://github.com/nicolaslopezj/meteor-apollo-accounts). This package uses the Meteor Accounts methods in GraphQL, it's compatible with the accounts you have saved in your database and you may use `nicolaslopezj:apollo-accounts` and Meteor's DDP accounts at the same time.

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

1. Use `isomorphic-fetch` to polyfill `fetch` server-side (used by Apollo Client's network interface).
2. Connect your express server to Meteor's existing server with [WebApp.connectHandlers.use](https://docs.meteor.com/packages/webapp.html)
3. Do not end the connection with `res.send()` and `res.end()` use `req.dynamicBody` and `req.dynamicHead` instead and call `next()`. [more info](https://github.com/meteor/meteor/pull/3860)

The idea is that you need to let Meteor to finally render the html you can just provide it extra `body` and or `head` for the html and Meteor will append it, otherwise CSS/JS and or other merged html content that Meteor serve by default (including your application main .js file) will be missing.

Here is a full working example:
```
meteor add apollo webapp
meteor npm install --save react react-dom apollo-client redux react-apollo react-router react-helmet express isomorphic-fetch
```

```js
import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { meteorClientConfig, createMeteorNetworkInterface } from 'meteor/apollo';
import React from 'react';
import ReactDOM from 'react-dom/server';
import ApolloClient from 'apollo-client';
import { createStore, combineReducers, applyMiddleware, compose } from 'redux';
import { ApolloProvider, renderToStringWithData } from 'react-apollo';
import { match, RouterContext } from 'react-router';
import Express from 'express';
// #1 import isomorphic-fetch so the network interface can be created
import 'isomorphic-fetch';
import Helmet from 'react-helmet';

import routes from '../both/routes';
import rootReducer from '../../ui/reducers';
import Body from '../both/routes/body';

// 1# do not use new
const app = Express(); // eslint-disable-line new-cap

app.use((req, res, next) => {
  match({ routes, location: req.originalUrl }, (error, redirectLocation, renderProps) => {
    if (redirectLocation) {
      res.redirect(redirectLocation.pathname + redirectLocation.search);
    } else if (error) {
      console.error('ROUTER ERROR:', error); // eslint-disable-line no-console
      res.status(500);
    } else if (renderProps) {
      // use createMeteorNetworkInterface to get a preconfigured network interface
      // #1 network interface can be used server-side thanks to polyfilled `fetch`
      const networkInterface = createMeteorNetworkInterface({
        opts: {
          credentials: 'same-origin',
          headers: req.headers,
        },
        // possible current user login token stored in the cookies thanks to 
        // a third-party package like meteorhacks:fast-render
        loginToken: req.cookies['meteor-login-token'],
      });

      // use meteorClientConfig to get a preconfigured Apollo Client options object
      const client = new ApolloClient(meteorClientConfig({ networkInterface }));

      const store = createStore(
        combineReducers({
          ...rootReducer,
          apollo: client.reducer(),
        }),
        {}, // initial state
        compose(
          applyMiddleware(client.middleware()),
        ),
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
        // #3 `req.dynamicBody` will hold that body and meteor will take care of
        // actually appending it to the end result
        req.dynamicBody = ReactDOM.renderToStaticMarkup(body);
        const head = Helmet.rewind();
        // #3 `req.dynamicHead` in this case we use `react-helmet` to add seo tags
        req.dynamicHead = `  ${head.title.toString()}
  ${head.meta.toString()}
  ${head.link.toString()}
`;
        // #3 Important we do not want to return this, we just let meteor handle it
        next();
      });
    } else {
      console.log('not found'); // eslint-disable-line no-console
    }
  });
});
// #2 connect your express server with meteor's
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

## Importing `.graphql` files

An easy way to work with GraphQL is by importing `.graphql` files directly using the `import` syntax.

```bash
meteor add swydo:graphql
```

Instead of the `/imports/api/schema.js` file, create a `/imports/api/schema.graphql` file with the same content as before:

```graphql
type Query {
  say: String
}
```

One of the benefits you'll get right away is good highlighting by GitHub and your IDE!

Now we can import the schema:

```js
import typeDefs from '/imports/api/schema.graphql';
```

Use `typeDefs` as before in the above examples. You can [pass it directly to `makeExecutableSchema`](https://github.com/apollographql/graphql-tools/pull/300) like before.

The import syntax will also work for any other `.graphql` file besides your main schema. So you'll be able to import query, mutation and subscription files without needing to manually parse them with the [graphql-tag](https://github.com/apollographql/graphql-tag).

For more benefits, see the [GrahpQL build plugin README](https://github.com/Swydo/meteor-graphql/blob/master/README.md#benefits).

## Blaze

If you are looking to integrate Apollo with [Blaze](http://blazejs.org/), you can use the [swydo:blaze-apollo](https://github.com/Swydo/blaze-apollo) package:

```js
import { setup } from 'meteor/swydo:blaze-apollo';

const client = new ApolloClient(meteorClientConfig());

setup({ client });
```

This gives you reactive GraphQL queries in your templates!

```js
Template.hello.helpers({
  hello() {
    return Template.instance().gqlQuery({
      query: HELLO_QUERY
    }).get();
  }
});
```

## Subscriptions

You can also use GraphQL subscriptions with your Meteor app if you need to. The following code gives an example of a complete configuration that enables all the features of subscriptions in addition to base GraphQL.

### Client
```js
import { ApolloClient } from 'apollo-client';
import { SubscriptionClient, addGraphQLSubscriptions } from 'subscriptions-transport-ws';
import { getMeteorLoginToken, createMeteorNetworkInterface } from 'meteor/apollo';

// "basic" Meteor network interface
const networkInterface = createMeteorNetworkInterface();

// create a websocket uri based on your app absolute url (ROOT_URL), ex: ws://localhost:3000
const websocketUri = Meteor.absoluteUrl('subscriptions').replace(/^http/, 'ws');
   
// create a websocket client
const wsClient = new SubscriptionClient(websocketUri, {
  reconnect: true,
  // pass some extra information to the subscription, like the current user:
  connectionParams: {
    // getMeteorLoginToken = get the Meteor current user login token from local storage
    meteorLoginToken: getMeteorLoginToken(),
  },
});

// enhance the interface with graphql subscriptions
const networkInterfaceWithSubscriptions = addGraphQLSubscriptions(networkInterface, wsClient);

// enjoy graphql subscriptions with Apollo Client
const client = new ApolloClient({ networkInterface: networkInterfaceWithSubscriptions });
```

### Server

The same `context` is used for both the resolvers and the GraphQL subscriptions. This also means that [authentication in the websocket transport](http://dev.apollodata.com/tools/graphql-subscriptions/authentication.html) is configured out-of-the-box.

Note that `PubSub` from `graphql-subscriptions` is not suitable for production. You should wire your `SubscriptionManager` with [Redis subscriptions](https://github.com/davidyaha/graphql-redis-subscriptions) or [MQTT subscriptions](https://github.com/davidyaha/graphql-mqtt-subscriptions) in case you want to use them in production apps.

```js
import { SubscriptionManager } from 'graphql-subscriptions';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { createApolloServer, addCurrentUserToContext } from 'meteor/apollo';
 
// your executable schema
const schema = ...

// any additional context you use for your resolvers, if any
const context = {};
 
// the pubsub mechanism of your choice, for instance:
// - PubSub from graphql-subscriptions (not recommended for production)
// - RedisPubSub from graphql-redis-subscriptions
// - MQTTPubSub from graphql-mqtt-subscriptions
const pubsub = new PubSub();
 
// subscriptions path which fits witht the one you connect to on the client
const subscriptionsPath = '/subscriptions';
 
// start a graphql server with Express handling a possible Meteor current user
createApolloServer({ 
  schema,
  context 
});
 
// create the subscription manager thanks to the schema & the pubsub mechanism
const subscriptionManager = new SubscriptionManager({
  schema,
  pubsub,
});
 
// start up a subscription server
new SubscriptionServer(
  {
    subscriptionManager,
    // on connect subscription lifecycle event
    onConnect: async (connectionParams, webSocket) => {
      // if a meteor login token is passed to the connection params from the client, 
      // add the current user to the subscription context
      const subscriptionContext = connectionParams.meteorLoginToken
        ? await addCurrentUserToContext(context, connectionParams.meteorLoginToken)
        : context;

      return subscriptionContext;
    },
  },
  {
    // bind the subscription server to Meteor WebApp
    server: WebApp.httpServer,
    path: subscriptionsPath,
  }
);
```
