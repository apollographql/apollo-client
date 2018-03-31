---
title: Introduction
description: What is Apollo Client and what does it do?
---

Apollo Client is the best way to use GraphQL to build client applications. The client is designed to help you quickly build a UI that fetches data with GraphQL. You can use  Apollo Client in any JavaScript front end, the client is:

- **Incrementally adoptable**. You can drop it into an existing app today.
-  **Universally compatible**. Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
- **Simple to get started with**. Start loading data right away and learn about advanced features later.
- **Inspectable and understandable**. Interrogate and understand exactly what is happening in an application.
- **Built for interactive apps**. Application users make changes and see them reflected immediately.
- **Small and flexible**. You don't get stuff your application doesn't need.

Finally, the Apollo Client is **Community driven**, which means its creators make sure it serves a variety of use cases.

<h2 title="Where to go next" id="starting">Where to go next</h2>

- Use the **ESSENTIALS** to [get started with a React example](./essentials/get-started.html) and learn the basics.
- The **FEATURES** detail the amazing things you can do with Apollo Client.
- The **ADVANCED** capabilities of Apollo Client details features that your app may need.
- Use the **RECIPES** to learn about and understand common patterns.
- Review our **API** to discover API details for Apollo Client and React Apollo.


<h2 id="other-platforms" title="Prefer a non-React Platform?">Prefer a non-React Platform?</h2>

To get the most out of Apollo Client, you should use it with one of its several
view layer integrations. The examples in this doc use the React integration. If
you aren't using React, Apollo supports many other platforms and documentation
to get you started:

- JavaScript
  - [Angular](/docs/angular)
  - [Vue](./integrations.html#vue)
  - [Meteor](./recipes/meteor.html)
  - [Ember](./integrations.html#ember)
  - [Polymer](./integrations.html#polymer)
- Native mobile
  - [Native iOS with Swift](/docs/ios)
  - [Native Android with Java](https://github.com/apollographql/apollo-android)

<h2 id="graphql-servers">Just using GraphQL?</h2>

We believe that using GraphQL should be easy and fun. One way Apollo supports
this is that you can write your queries in
[GraphiQL](https://github.com/graphql/graphiql) and they will just work with
Apollo Client! Because Apollo doesn't assume anything beyond the official
GraphQL specification, it works with every GraphQL server implementation, for
*every* language.

Apollo doesn't impose any requirements on your schema either! If you can send a
query to a standard GraphQL server, Apollo can handle it. You can find a list of
GraphQL server implementations on
[graphql.org](http://graphql.org/code/#server-libraries).
