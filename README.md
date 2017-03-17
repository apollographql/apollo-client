# [Apollo client](http://dev.apollodata.com/) [![npm version](https://badge.fury.io/js/apollo-client.svg)](https://badge.fury.io/js/apollo-client) [![Get on Slack](https://img.shields.io/badge/slack-join-orange.svg)](http://www.apollostack.com/#slack)

Apollo Client is a fully-featured caching GraphQL client with integrations for React, Angular, etc. It allows you to easily build UI components that fetch data via GraphQL. To get the most value out of `apollo-client` you should use it with one of its view layer integrations.

To get started with the React integration go to our [**React Apollo documentation website**](http://dev.apollodata.com/react/).

Apollo Client also has view layer integrations for [all the popular frontend frameworks](#learn-how-to-use-apollo-client-with-your-favorite-framework). For the best experience make sure to use the view integration layer for your frontend framework of choice.

Apollo Client can be used in any JavaScript frontend where you want to use data from a GraphQL server. It's:

1. **Incrementally adoptable**, so that you can drop it into an existing JavaScript app and start using GraphQL for just part of your UI.
2. **Universally compatible**, so that Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
2. **Simple to get started with**, you can start loading data right away and learn about advanced features later.
3. **Inspectable and understandable**, so that you can have great developer tools to understand exactly what is happening in your app.
4. **Built for interactive apps**, so your users can make changes and see them reflected in the UI immediately.
4. **Small and flexible**, so you don't get stuff you don't need. The core is under 25kb compressed.
5. **Community driven**, Apollo is driven by the community and serves a variety of use cases. Everything is planned and developed in the open.

Get started on the [home page](http://dev.apollodata.com/), which has great examples for a variety of frameworks.

## Installation

```bash
npm install apollo-client graphql-tag --save
```

To use this client in a web browser or mobile app, you'll need a build system capable of loading NPM packages on the client. Some common choices include Browserify, Webpack, and Meteor 1.3.

**NEW:** Install the [Apollo Client Developer tools for Chrome](https://chrome.google.com/webstore/detail/apollo-client-developer-t/jdkknkkbebbapilgoeccciglkfbmbnfm) for a great GraphQL developer experience!

## Usage

If you know you want to use the core `apollo-client` package you can get started by constructing an instance of the core class [`ApolloClient`][] with a network interface created by network interface you may call the [`createNetworkInterface`][] function like so:

```js
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import gql from 'graphql-tag';

const client = new ApolloClient({
  networkInterface: createNetworkInterface({
    uri: 'https://graphql.example.com',
  }),
});
```

Replace `https://graphql.example.com` with your GraphQL APIs URL and you’re off to the moon!

To execute a query with your client you may now call the `client.query` method like this:

```js
client.query({
  query: gql`
    query TodoApp {
      todos {
        id
        text
        completed
      }
    }
  `,
})
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

Now your client will be primed with some data in its cache. You can continue to make queries, or you can get your `client` instance to perform all sorts of advanced tasks on your GraphQL data. Such as [reactively watching queries with `watchQuery`][], [changing data on your server with `mutate`][], or [reading a fragment from your local cache with `readFragment`][].

To learn more about all of the features available to you through the `apollo-client` package be sure to read through the [**`apollo-client` API reference**][].

[`ApolloClient`]: http://dev.apollodata.com/core/apollo-client-api.html
[`createNetworkInterface`]: http://dev.apollodata.com/core/network.html
[reactively watching queries with `watchQuery`]: http://dev.apollodata.com/core/apollo-client-api.html#ApolloClient\.watchQuery
[changing data on your server with `mutate`]: http://dev.apollodata.com/core/apollo-client-api.html#ApolloClient\.mutate
[reading a fragment from your local cache with `readFragment`]: http://dev.apollodata.com/core/apollo-client-api.html#ApolloClient\.readFragment
[**`apollo-client` API reference**]: http://dev.apollodata.com/core/apollo-client-api.html

## Learn how to use Apollo Client with your favorite framework

- [React](http://dev.apollodata.com/react/)
- [Angular 2](http://dev.apollodata.com/angular2/)
- [Vue](https://github.com/Akryum/vue-apollo)
- [Ember](https://github.com/bgentry/ember-apollo-client)
- [Polymer](https://github.com/aruntk/polymer-apollo)
- [Meteor](http://dev.apollodata.com/core/meteor.html)
- [Blaze](http://github.com/Swydo/blaze-apollo)
- [Vanilla JS](http://dev.apollodata.com/core/)
- [Next.js](https://github.com/zeit/next.js/tree/master/examples/with-apollo)

---

## Contributing

[![Build status](https://travis-ci.org/apollographql/apollo-client.svg?branch=master)](https://travis-ci.org/apollographql/apollo-client)
[![Build status](https://ci.appveyor.com/api/projects/status/ajdf70delshw2ire/branch/master?svg=true)](https://ci.appveyor.com/project/stubailo/apollo-client/branch/master)
[![Coverage Status](https://coveralls.io/repos/github/apollographql/apollo-client/badge.svg?branch=master)](https://coveralls.io/github/apollographql/apollo-client?branch=master)

[Read the Apollo Contributor Guidelines.](CONTRIBUTING.md)

Running tests locally:

```
# nvm use node
npm install
npm test
```

This project uses TypeScript for static typing and TSLint for linting. You can get both of these built into your editor with no configuration by opening this project in [Visual Studio Code](https://code.visualstudio.com/), an open source IDE which is available for free on all platforms.

#### Important discussions

If you're getting booted up as a contributor, here are some discussions you should take a look at:

1. [Static typing and why we went with TypeScript](https://github.com/apollostack/apollo-client/issues/6) also covered in [the Medium post](https://medium.com/apollo-stack/javascript-code-quality-with-free-tools-9a6d80e29f2d#.k32z401au)
1. [Idea for pagination handling](https://github.com/apollostack/apollo-client/issues/26)
1. [Discussion about interaction with Redux and domain vs. client state](https://github.com/apollostack/apollo-client/issues/98)
1. [Long conversation about different client options, before this repo existed](https://github.com/apollostack/apollo/issues/1)
