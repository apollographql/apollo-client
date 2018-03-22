---
title: Introduction
description: What is Apollo Client and what does it do?
---

[Apollo](https://www.nasa.gov/mission_pages/apollo/missions/index.html) Client is the best way to use GraphQL to build client applications. It is designed from day one to make it easy to build UI that fetches data with GraphQL. To get the most out of Apollo Client, you should use it with one of its view layer integrations like [react](./essentials/get-started).

Apollo Client can be used in any JavaScript frontend where you want to describe your data using GraphQL. It's:

1. **Incrementally adoptable**, so that you can drop it into an existing app today.
2. **Universally compatible**, so that Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
3. **Simple to get started with**, so you can start loading data right away and learn about advanced features later.
4. **Inspectable and understandable**, so that you can understand exactly what is happening in your app.
5. **Built for interactive apps**, so your users can make changes and see them reflected immediately.
6. **Small and flexible**, so you don't get stuff you don't need.
7. **Community driven**, because Apollo is driven by the community and serves a variety of use cases.

These docs will help you to go from getting started with Apollo to becoming an expert!

<h2 title="Getting started" id="starting">Getting Started</h2>

The docs for Apollo Client are mainly written using the [React integration](./essentials/get-started.html), but most of the examples work no matter where you use Apollo. The docs are broken into five distinct sections to make it easy to find your way around:

1. **Essentials**, which outline the why and how of using Apollo Client to build your application.
2. **Features**, which go over all of the amazing things you can do with Apollo Client.
2. **Advanced**, which showcase some of the advanced capabilities of Apollo Client that your app may need.
3. **Recipes**, to isolate and explain how to do common patterns.
4. **Reference**, to act as an entry point to find API details for the client.

Getting started is as simple as installing a few libraries from [npm](https://npmjs.org)! The [setup](./essentials/get-started.html) is a good place to start your adventure with Apollo!

<h2 id="graphql-servers">Just GraphQL</h2>

We believe that using GraphQL should be easy and fun. One of the ways Apollo is designed for this is that if you can write your query in [GraphiQL](https://github.com/graphql/graphiql), it'll work with Apollo Client! Because it doesn't assume anything beyond the official GraphQL specification, Apollo works with every GraphQL server implementation, for *every* language. It doesn't impose any requirements on your schema either! If you can send a query to a standard GraphQL server, Apollo can handle it. You can find a list of GraphQL server implementations on [graphql.org](http://graphql.org/code/#server-libraries).

<h2 id="other-platforms" title="Other JS + native platforms">Other JavaScript + native platforms</h2>

This documentation site is written with examples using React, but Apollo has an implementation for every client platform:

- JavaScript
  - [Angular](/docs/angular)
  - [Vue](./integrations.html#vue)
  - [Meteor](./recipes/meteor.html)
  - [Ember](./integrations.html#ember)
  - [Polymer](./integrations.html#polymer)
- Native mobile
  - [Native iOS with Swift](/docs/ios)
  - [Native Android with Java](https://github.com/apollographql/apollo-android)
