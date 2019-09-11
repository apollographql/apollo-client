---
title: Integrating with Meteor
order: 152
description: Specifics about using Apollo in your Meteor application.
---

There are two main ways to use Apollo in your Meteor app:

- `meteor add swydo:ddp-apollo` provides a network Link that supports Meteor user accounts and subscriptions, all over DDP: [Documentation](https://github.com/Swydo/ddp-apollo)
- `meteor add apollo` supports Meteor user accounts over HTTP, with documentation below.

## Compatibility

meteor/apollo | apollo client | apollo server
--- | --- | ---
3.* | 2.* | 2.*
2.* | 2.* | 1.*
1.* | 1.* | 1.*

## Usage

```sh
meteor add apollo
meteor npm install graphql apollo-server-express apollo-boost
```

### Client

Create your [ApolloClient](https://www.apollographql.com/docs/react/) instance:

```js
import { Accounts } from 'meteor/accounts-base'
import ApolloClient from 'apollo-boost'

const client = new ApolloClient({
  uri: '/graphql',
  request: operation =>
    operation.setContext(() => ({
      headers: {
        authorization: Accounts._storedLoginToken()
      }
    }))
})
```

Or if you're using `apollo-client` instead of `apollo-boost`, use `MeteorAccountsLink()`:

```js
import { ApolloClient } from 'apollo-client'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { ApolloLink } from 'apollo-link'
import { HttpLink } from 'apollo-link-http'
import { MeteorAccountsLink } from 'meteor/apollo'

const client = new ApolloClient({
  link: ApolloLink.from([
    new MeteorAccountsLink(),
    new HttpLink({
      uri: '/graphql'
    })
  ]),
  cache: new InMemoryCache()
})
```

If you want to change which header the token is stored in:

```js
MeteorAccountsLink({ headerName: 'meteor-login-token' })
```

(The default is `authorization`.)

### Server

Set up the [Apollo server](https://www.apollographql.com/docs/apollo-server/):

```js
import { ApolloServer, gql } from 'apollo-server-express'
import { WebApp } from 'meteor/webapp'
import { getUser } from 'meteor/apollo'

import typeDefs from './schema'
import resolvers from './resolvers'

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => ({
    user: await getUser(req.headers.authorization)
  })
})

server.applyMiddleware({
  app: WebApp.connectHandlers,
  path: '/graphql'
})

WebApp.connectHandlers.use('/graphql', (req, res) => {
  if (req.method === 'GET') {
    res.end()
  }
})
```

Now when the client is logged in (ie has an unexpired Meteor login token in localStorage), your resolvers will have a `context.user` property with the user doc.

### IDE

There are two options for using an IDE that will make authenticated GraphQL requests:

- [Apollo devtools](https://chrome.google.com/webstore/detail/apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm?hl=en-US) GraphiQL:
  - Login to your app
  - Open Apollo devtools to the GraphiQL section
- [GraphQL Playground](https://github.com/prismagraphql/graphql-playground):
  - Install with `brew cask install graphql-playground`
  - Login to your app
  - In the browser console, enter `localStorage.getItem('Meteor.loginToken')`
  - Copy the string returned
  - In Playground:
    - At the top, enter `http://localhost:3000/graphql`
    - Under HTTP HEADERS, enter `{ "authorization": "copied string" }`

### Typings

Your Meteor apps may rely on static typings with TypeScript. If so, it is recommended to use the [ambient TypeScript definition for this Atmosphere package](https://github.com/KeithGillette/Apollo-GraphQL-Meteor-Integration-Typings).


## Accounts

The above solutions assume you're using Meteor's client-side accounts functions like `Accounts.createUser` and `Accounts.loginWith*`, which use Meteor DDP messages.

If you want to instead only use GraphQL in your app, you can use [nicolaslopezj:apollo-accounts](https://github.com/nicolaslopezj/meteor-apollo-accounts). This package uses the Meteor Accounts methods in GraphQL, and it's compatible with the accounts you have saved in your database (and you could use `nicolaslopezj:apollo-accounts` and Meteor's DDP accounts at the same time).

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
There are two additional configurations that you need to keep in mind when using [React Server Side Rendering](/features/server-side-rendering/) with Meteor.

1. Use `isomorphic-fetch` to polyfill `fetch` server-side (used by Apollo Client's network interface).
2. Connect your express server to Meteor's existing server with [WebApp.connectHandlers.use](https://docs.meteor.com/packages/webapp.html)
3. Do not end the connection with `res.send()` and `res.end()` use `req.dynamicBody` and `req.dynamicHead` instead and call `next()`. [more info](https://github.com/meteor/meteor/pull/3860)

The idea is that you need to let Meteor to finally render the html you can just provide it extra `body` and or `head` for the html and Meteor will append it, otherwise CSS/JS and or other merged html content that Meteor serve by default (including your application main .js file) will be missing.

Here is a full working example using `apollo@2.*` (outdated):

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

*This section uses the outdated `apollo@2.*` API.*

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
