---
title: Introduction
description: What is Apollo Client and what does it do?
---

[Apollo](https://www.nasa.gov/mission_pages/apollo/missions/index.html) Client is the ultra-flexible, community driven GraphQL client for React, JavaScript, and native platforms. It is designed from the ground up to make it easy to build UI components that fetch data with GraphQL. To get the most value out of Apollo Client, you should use it with one of its view layer integrations. To get started with the React integration, go to [setup](./basics/setup.html).

Apollo Client also has view layer integrations for [all the popular frontend frameworks](./basics/integrations.html). For the best experience, make sure to use the view integration layer for your frontend framework of choice.

Apollo Client can be used in any JavaScript frontend where you want to describe your data using GraphQL. It's:

1. **Incrementally adoptable**, so that you can drop it into an existing JavaScript app and start using GraphQL for just part of your UI.
2. **Universally compatible**, so that Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
3. **Simple to get started with**, so you can start loading data right away and learn about advanced features later.
4. **Inspectable and understandable**, so that you can have great developer tools to understand exactly what is happening in your app.
5. **Built for interactive apps**, so your users can make changes and see them reflected in the UI immediately.
6. **Small and flexible**, so you don't get stuff you don't need. The core is under 12kb compressed.
7. **Community driven**, because Apollo is driven by the community and serves a variety of use cases. Everything is planned and developed in the open.

These docs will help you to go from getting started with Apollo to becoming an expert!

<h2 title="Getting started" id="starting">Getting Started</h2>

The docs for Apollo Client are mainly written using the [React integration](./basics/setup.html), but most of the examples work no matter where you use Apollo. The docs are broken into four distinct sections to make it easy to find your way around:

1. **Basics**, which outline the why and how of using Apollo Client to build your application.
2. **Features**, which showcase some of the advanced capabilities of Apollo Client that your app may need.
3. **Recipes**, to isolate and explain how to do common patterns.
4. **Reference**, to act as an entry point to find API details for the client.

Getting started is as simple as installing a few libraries from [npm](https://npmjs.org)! The [setup](./basics/setup.html) is a good place to start your adventure with Apollo!

<h2 id="Compatibility">Compatible tools</h2>

We want you to love working with Apollo Client, so we work extra hard to make sure it works with the client or server tools you're already using! The maintainers and contributors focus on solving the hard problems around GraphQL caching, request management, and UI updating, and we want that to be available to anyone regardless of their technical requirements and preferences for other parts of the app.

<h2 id="react-toolbox" title="Perfect for React">The React toolbox</h2>

Apollo is lovingly designed to work nicely with all of the tools used by today's React developers. Here are some in particular:

- **React Native and Expo**: Apollo works out of the box in React Native. It's even preinstalled in [Expo Snack](https://sketch.expo.io/H1QdWZUjg), so you can build a React Native + Apollo app right in your browser.
- **React Router**: Apollo Client is completely router-independent, which means you can use it with any version of [React Router](https://github.com/ReactTraining/react-router) or any other routing library for React. It's even easy to set up [server-side rendering](./recipes/server-side-rendering.html).
- **Recompose**: With [Recompose](https://github.com/acdlite/recompose), React-Apollo's Higher Order Component can be combined with a variety of other utilities to add behaviors to your components. [Read how to use it for loading state and variables](https://dev-blog.apollodata.com/simplify-your-react-components-with-apollo-and-recompose-8b9e302dea51#.z7tbkf8er) and also [mutations](https://medium.com/front-end-developers/how-i-write-mutations-in-apollo-w-recompose-1c0ab06ef4ea#.iobufopba) and to [combine with the Redux container](https://medium.com/welikegraphql/use-of-recompose-in-universal-react-apollo-example-3d1f89bc945b#.dtxnibu0w).
- **Next.js**: You can use Apollo with the lightweight Next.js framework for universal rendered React apps. Just check out [this article](https://dev-blog.apollodata.com/whats-next-js-for-apollo-e4dfe835d070) for the details, or download the [official example](https://github.com/zeit/next.js/tree/master/examples/with-apollo).

If you have a favorite React tool, and something in Apollo makes it difficult to integrate, please open an issue and let's work together to make it work nicely and add it to the list!

<h2 id="graphql-servers">GraphQL servers</h2>

We believe that using GraphQL should be easy and fun. One of the ways Apollo is designed for this is that if you can write your query in [GraphiQL](https://github.com/graphql/graphiql), it'll work with Apollo Client! Because it doesn't assume anything beyond the official GraphQL specification, Apollo works with every GraphQL server implementation, for *every* language. It doesn't impose any requirements on your schema either! If you can send a query to a standard GraphQL server, Apollo can handle it. You can find a list of GraphQL server implementations on [graphql.org](http://graphql.org/code/#server-libraries).

<h2 id="other-platforms" title="Other JS + native platforms">Other JavaScript + native platforms</h2>

This documentation site is written with examples using React, but Apollo has an implementation for every client platform:

- JavaScript
  - [Angular](/docs/angular)
  - [Vue](./basics/integrations.html#vue)
  - [Meteor](./recipes/meteor.html)
  - [Ember](./basics/integrations.html#ember)
  - [Polymer](./basics/integrations.html#polymer)
- Native mobile
  - [Native iOS with Swift](/docs/ios)
  - [Native Android with Java](https://github.com/apollographql/apollo-android)
