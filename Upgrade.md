## Upgrading to Apollo Client 2.0

# tldr;
The 2.0 version of Apollo is targeting a more customizable experience with GraphQL. It prioritizes features like custom execution chains (using Apollo Link) and custom stores while providing powerful defaults. It will be an overall minor change to the API so you won't have to change very much code in your current app at all! Apollo ❤️  backwards compat

## About
The 2.* version of Apollo Client builds on the original principles of the project. For reference, those goals are:

1. **Incrementally adoptable**, so that you can drop it into an existing JavaScript app and start using GraphQL for just part of your UI.
2. **Universally compatible**, so that Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
3. **Simple to get started with**, you can start loading data right away and learn about advanced features later.
4. **Inspectable and understandable**, so that you can have great developer tools to understand exactly what is happening in your app.
5. **Built for interactive apps**, so your users can make changes and see them reflected in the UI immediately.
6. **Small and flexible**, so you don't get stuff you don't need. The core is under 25kb compressed.
7. **Community driven**, Apollo is driven by the community and serves a variety of use cases. Everything is planned and developed in the open.

Based on feedback from a wide variety of users, the 2.* version will double down on being incrementally adoptable and flexible by allowing much stronger extension points. Customization of the client (i.e. data store, execution chain, etc) will be first class in the revised API. The next version will also take steps to reduce the overall size of the default client and provide the foundations for Apollo powering more of the application experience from development to production (i.e. client side state management).

The goal of the 2.0 launch is not to provide all of the new features that have been asked to be built in. Instead, the 2.0 launch makes a few key changes to both management of the code base (lerna / small modules) and the changes necessary to support custom stores and links **fully**. Apollo Client 2.0 is the jumping off point for user-land driven innovation (custom stores, custom links) and internal refactor (moving query manager into links, breaking apart the store / links into packages, etc)

## Details
There are three main changes for the 2.0 version.
- [x] new Store API design and default implementation
- [x] deprecate NetworkInterface in favor of Apollo Link
- [x] rework repo to allow for smaller packages / easier contributions

## Immediate wins
* retrying queries on flaky networks
* support in place to handle offline interactions
* faster default store
* ability to build stores for things like mobx, redux, ng-rx, vuex, and more!
* smaller bundle size

## Contributing
If you are interested in contributing to the 2.0 release that is SO great!! There are a number of ways to help out! Please comment on this PR if you want to do any of the following!
- implement any of the main features
- test out the 2.0 in your application (in a prerelease version)
- write a custom link
- write a custom store
- help with documentation and upgrade guides (even a codemod maybe!)

## Installation instructions
The 2.0 of apollo is split into a few packages. To try it out in your app you can install the following
```bash
npm i --save apollo-client@beta apollo-cache-inmemory@beta apollo-link-http@beta
```

This will give you the replacement for networkInterfaces (links), the current apollo-cache (cache-inmemory) and the new client.

For updating your app, you should only need to change the constructor. For example, a meteor SSR app that looked like this:
```js
import { render } from 'react-dom';
import { onPageLoad } from 'meteor/server-render';

// apollo imports
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import { ApolloProvider } from 'react-apollo';

import { App } from '/imports/app';

export const start = () => {
  const client = new ApolloClient({
    networkInterface: createNetworkInterface({ uri: 'http://localhost:3000' }),
    initialState: { apollo: window.__APOLLO_STATE__ },
  });

  const WrappedApp = (
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  );

  render(WrappedApp, document.getElementById('app'));
};

onPageLoad(start);
```

Now looks like this:
```js
import { render } from 'react-dom';
import { onPageLoad } from 'meteor/server-render';

// apollo imports
import ApolloClient from 'apollo-client';
import Link from 'apollo-link-http';
import Cache from 'apollo-cache-inmemory'
import { ApolloProvider } from 'react-apollo';

import { App } from '/imports/app';

export const start = () => {
  const client = new ApolloClient({
    link: new Link({ uri: 'http://localhost:3000' }),
    cache: new Cache(window.__APOLLO_STATE__),
  });

  // XXX this will have to be updated in react-apollo
  client.initStore = () => {}

  const WrappedApp = (
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  );

  render(WrappedApp, document.getElementById('app'));
};

onPageLoad(start);
```

# Apollo Cache InMemory
The configuration that used to be on the constructor of Apollo Client used by the store are now moved to the InMemoryCache implementation. Upgrading of that looks like this:

```js
// previous
import ApolloClient from "apollo-client";

const client = new ApolloClient({
  fragmentMatcher: // matcher,
  dataIdFromObject: // custom function,
  addTypename: true,
  customResolvers: // custom resolvers
  initialState: window.__APOLLO_STATE__
});

```

becomes

```js
import ApolloClient from "apollo-client";
import InMemoryCache from "apollo-cache-inmemory";

const cache = new InMemoryCache({
  fragmentMatcher: // matcher,
  dataIdFromObject: // custom function,
  addTypename: true,
  customResolvers: // custom resolvers
});

const client = new ApolloClient({
  cache: cache.restore(window.__APOLLO_STATE__ || {})
});
```
