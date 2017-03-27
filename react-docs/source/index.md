---
title: React Apollo
sidebar_title: Introduction
description: Apollo Client manages your server-side data in your React app so you don't have to.
---

This is the official guide for using GraphQL in your React or React Native app using the [react-apollo](https://github.com/apollostack/react-apollo) package. React-Apollo is a convenient yet powerful way to bind GraphQL queries to your React components, so that you can focus on developing your UI while data fetching and management just gets out of the way.

<h2 id="tutorials">Tutorials</h2>

The best way to get started with Apollo in your React app is to do a quick tutorial, which will walk you through setting up a basic app and doing some GraphQL operations. Then, you can come back to this guide to dig into the details.

<h3>[Learn Apollo](https://www.learnapollo.com)</h3>

This tutorial covers building the client side of a simple Pokedex app from start to finish. It's available for [React](https://www.learnapollo.com/tutorial-react/react-01), [React Native](https://www.learnapollo.com/tutorial-react-native/react-native-01), and other platforms. Learn Apollo is maintained by the team and community around [Graphcool](https://www.graph.cool/), a hosted GraphQL backend platform that lets you stand up a GraphQL server without writing any code.

<h3 id="full-stack-graphql">[Full-Stack GraphQL + React tutorial](https://dev-blog.apollodata.com/full-stack-react-graphql-tutorial-582ac8d24e3b#.cwvxzphyc)</h3>

This tutorial covers how to set up Apollo Client, how to write a simple server, and how to connect them together, and more parts are being produced almost every week. It's written by [Jonas Helfer](https://twitter.com/helferjs), the main developer behind React-Apollo.

For a step-by-step hands-on tutorial you can also check out the [Learn Apollo](https://www.learnapollo.com) website by Graphcool.

<h2 id="compatibility">Compatibility</h2>

The primary design point of Apollo Client is to work with any client or server architecture. The core maintainers focus on solving the hard problems around GraphQL caching, request management, and UI updating, and we want that to be available to anyone regardless of their technical requirements for other parts of the stack.

<h3 id="compatibility">The React toolbox</h3>

Apollo is specifically designed to work nicely with all of the tools used by today's React developers. Here are some in particular:

- **React Native and Expo**: Apollo works out of the box in React Native. It's even preinstalled in [Expo Sketch](https://sketch.expo.io/H1QdWZUjg), so you can build a React Native + Apollo app right in your browser.
- **Redux**: Apollo Client uses Redux internally, and you can [integrate it into your existing store](redux.html) to use your favorite Redux tools such as the dev tools or persistence libraries. You can also use Apollo alongside any other data management library, such as MobX.
- **React Router**: Apollo Client is completely router-independent, which means you can use it with any version of [React Router](https://github.com/ReactTraining/react-router) or any other routing library for React. It's even easy to set up [server-side rendering](http://localhost:4000/react/server-side-rendering.html).
- **Recompose**: With [Recompose](https://github.com/acdlite/recompose), React-Apollo's Higher Order Component can be combined with a variety of other utilities to add behaviors to your components. [Read how to use it for loading state and variables](https://dev-blog.apollodata.com/simplify-your-react-components-with-apollo-and-recompose-8b9e302dea51#.z7tbkf8er) and also [mutations](https://medium.com/front-end-developers/how-i-write-mutations-in-apollo-w-recompose-1c0ab06ef4ea#.iobufopba) and to [combine with the Redux container](https://medium.com/welikegraphql/use-of-recompose-in-universal-react-apollo-example-3d1f89bc945b#.dtxnibu0w).
- **Next.js**: You can use Apollo with the lightweight Next.js framework for universal rendered React apps. Just check out [this article](https://dev-blog.apollodata.com/whats-next-js-for-apollo-e4dfe835d070) for the details, or download the [official example](https://github.com/zeit/next.js/tree/master/examples/with-apollo).

If you have a favorite React tool, and something in Apollo makes it difficult to integrate, open an issue and let's work together to make it work nicely and add it to the list!

<h3 id="graphql-servers">GraphQL servers</h3>

Because it doesn't assume anything beyond the official GraphQL specification, Apollo works with every GraphQL server implementation, for every language. It doesn't impose any requirements on your schema either; if you can send a query to a standard GraphQL server, Apollo can handle it. You can find a list of GraphQL server implementations on [graphql.org](http://graphql.org/code/#server-libraries).

<h3 id="other-platforms">Other JS + native platforms</h3>

This documentation site is specifically about React, but Apollo has an implementation for every client platform:

- JavaScript
  - [Angular](/angular)
  - [Vanilla JS](/core)
- Native mobile
  - [Native iOS with Swift](http://dev.apollodata.com/ios/)
  - [Native Android with Java](https://github.com/apollographql/apollo-android)

<h2 id="goals">Project goals</h2>

The `apollo-client` Npm module is a JavaScript client for GraphQL. The goal of the package is to be:

1. **Incrementally adoptable**, so that you can drop it into an existing JavaScript app and start using GraphQL for just part of your UI.
2. **Universally compatible**, so that Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
2. **Simple to get started with**, you can just read this guide and get going.
3. **Inspectable and understandable**, so that you can have great developer tools to understand exactly what is happening in your app.
4. **Built for interactive apps**, so your users can make changes and see them reflected in the UI immediately.
5. **Community driven**, many of the components of Apollo (including the `react-apollo` integration) are driven by the community and serve real-world use cases from the outset, and all projects are planned and developed in the open.

The Apollo client does more than simply run your queries against your GraphQL server. It analyzes your queries and their results to construct a client-side cache of your data, which is kept up to date as further queries and mutations are run, fetching more results from the server. This means that your UI can be internally consistent and fully up-to-date with the state on the server with the minimum number of queries required.

The best way to use `apollo-client` in your React app is with `react-apollo`, a React-specific API that's designed to take full advantage of Apollo's features. The integration provides a natural "higher-order-component" API for queries and mutations, and will keep your rendered component tree up to date with the data in the cache seamlessly. The guide you're currently reading describes `react-apollo`.

<h2 id="comparison">Other GraphQL clients</h2>

If you are deciding whether to use `react-apollo` or some other GraphQL client, it's worth considering the [goals](#goals) of the project, and how they compare. In particular:

 - [Relay](https://facebook.github.io/relay/) is a performance-oriented and highly opinionated GraphQL client built by Facebook for their mobile applications. It focuses on enabling the co-location of queries and components, and is opinionated about the design of your GraphQL schema, especially in the case of pagination. Apollo has an analogous set of features to Relay, but is designed to be a general-purpose tool that can be used with any schema or any frontend architecture. Relay's coupling to a specific architecture enables some benefits but with the loss of some flexibility, which also lets the Apollo community iterate more rapidly and quickly test experimental features.
 - [Lokka](https://github.com/kadirahq/lokka) is a simple GraphQL Javascript client with a basic query cache. Apollo is more complex, but includes a much more sophisticated cache and set of advanced features around updating and refetching data.

<h2 id="learn-more">Other resources</h2>

- [GraphQL.org](http://graphql.org) for an introduction and reference to the GraphQL itself, partially written and maintained by the Apollo team.
- [Our website](http://www.apollodata.com/) to learn about Apollo open source and commercial tools.
- [Our blog on Medium](https://medium.com/apollo-stack) for long-form articles about GraphQL, feature announcements for Apollo, and guest articles from the community.
- [Our Twitter](https://twitter.com/apollographql) for in-the-moment news.
