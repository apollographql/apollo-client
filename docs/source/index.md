---
title: Introduction
description: What is Apollo Client and what does it do?
---

Apollo Client is the best way to use GraphQL to build client applications. The client is designed to help you quickly build a UI that fetches data with GraphQL, and can be used with any JavaScript front-end. The client is:

- **Incrementally adoptable:** You can drop it into an existing app today.
- **Universally compatible:** Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
- **Simple to get started with:** Start loading data right away and learn about advanced features later.
- **Inspectable and understandable:** Interrogate and understand exactly what is happening in an application.
- **Built for interactive apps:** Application users make changes and see them reflected immediately.
- **Small and flexible:** You don't get stuff your application doesn't need.
- **Community driven:** Apollo is driven by the community and serves a variety of use cases.

<h2 title="Getting started" id="starting">Getting started</h2>

The docs for Apollo Client are mainly written using the [React integration](./essentials/get-started.html), but most of the examples work no matter where you use Apollo. The docs are broken into five distinct sections to make it easy to find your way around:

1. **ESSENTIALS:** Outlines everything you need to know in order to get up and running quickly.
2. **FEATURES:** Details the amazing things you can do with Apollo Client.
3. **ADVANCED:** Covers the more advanced Apollo Client capabilities that your app may need.
4. **RECIPES:** Learn about and understand common patterns.
5. **API:** Full API details for Apollo Client and React Apollo.

<h2 id="other-platforms" title="Prefer a non-React Platform?">Prefer a non-React platform?</h2>

Most of this sites documentation examples are written using React, but Apollo Client supports many other platforms:

- JavaScript
  - [Angular](/docs/angular)
  - [Vue](./integrations.html#vue)
  - [Meteor](./recipes/meteor.html)
  - [Ember](./integrations.html#ember)
- Web Components
  - [Polymer](./integrations.html#web-components)
  - [lit-apollo](./integrations.html#web-components)
- Native mobile
  - [Native iOS with Swift](/docs/ios)
  - [Native Android with Java](/docs/android)

<h2 id="graphql-servers">Just using GraphQL?</h2>

We believe that using GraphQL should be easy and fun. One of the ways that Apollo supports this is that you can write your queries in [GraphiQL](https://github.com/graphql/graphiql) and they will just work with Apollo Client! Because Apollo Client doesn't assume anything beyond the official GraphQL specification, it works with every GraphQL server implementation, for *every* language. Apollo Client doesn't impose any requirements on your schema either! If you can send a query to a standard GraphQL server, Apollo Client can handle it. You can find a list of
GraphQL server implementations at [graphql.org](http://graphql.org/code/#server-libraries).
