---
title: Introduction
order: 0
---

This is the guide to using the [Apollo](http://apollostack.com) JavaScript GraphQL client with the [React](https://facebook.github.io/react/) rendering library.

The Apollo team builds and maintains a collection of utilities designed to make it easier to use [GraphQL](http://graphql.org) across a range of front-end and server technologies. Although this guide focuses on the integration with React, there is a similar guide in the works for Angular 2 (start [here](http://dev.apollodata.com/core/angular2.html) for now), and the `apollo-client` JavaScript package can be used in many other contexts too.

If you are looking to use Apollo with a native mobile client, there is a [iOS Client](https://github.com/apollostack/apollo-ios) in development and plans for an Android client too. On the other hand, the React integration documented here works with [React Native](https://facebook.github.io/react-native/) on both platforms without changes.

You can learn more about the Apollo project at the project's [home page](http://apollostack.com).

<h2 id="apollo-client">Apollo Client and React</h2>

The `apollo-client` npm module is a JavaScript client for GraphQL. The goal of the package is to be:

1. **Incrementally adoptable**, so that you can drop it into any JavaScript app.
2. **Simple to get started with**, you can just read one guide and get going.
3. **Inspectable and understandable**, so that you can have great developer tools to understand exactly what is happening in your app.
4. **Built for interactive apps**, so your users can make changes and see them reflected in the UI straight away.
5. **Community driven**, many of the components of Apollo (including the `react-apollo` integration) were driven by our community and serve real-world use cases from the outset, and all components are planned and developed in the open.

The Apollo client does more than simply run your queries against your GraphQL server. It analyzes your queries and their results to construct a client-side cache of your data, which is updated as further queries, mutations are run and data is pushed to you from the server. This means that your UI can remain fully up-to-date with the state on the server with the minimum number of queries required.

The best way to use `apollo-client` in your React app is with `react-apollo`, a React-specific API that's designed to take full advantage of Apollo. The integration provides a natural "higher-order-component" API for queries and mutations, and will keep your rendered component tree up to date with the data in the cache seamlessly.

<h2 id="what-it-works-with">What it works with</h2>

React Apollo provides a idiomatic React API, and is known to work in a straightforward way with many tools used in a typical React app. In particular:

 - It works with React Native out of the box;
 - It can integrate naturally with routers, such as React Router;
 - Uses Redux internally and you can [take advantage](redux.html) of this, but also can be used with any other client-side data library that integrates with React.

If you want to use Apollo with a different front-end environment (for instance a different JavaScript framework, or a native mobile app), it is possible too! Please check out the links at the top of this document, or head to our [developer site](http://apollostack.com) to get started.

<h2 id="comparison">How does Apollo compare to other GraphQL clients?</h2>

If you are deciding whether to use `react-apollo` or some other GraphQL client, it's worth considering the [goals](#apollo-client) of the project, and how they compare. In particular:

 - [Relay](https://facebook.github.io/relay/) is an awesome and performant GraphQL client built by Facebook for their mobile applications. It is designed to emphasize the co-location of queries and components, and is thus tightly integrated with the React framework (which is also developed at Facebook).

 - [Lokka](https://github.com/kadirahq/lokka) is a simple GraphQL Javascript client with a basic query cache.

<h2 id="learn-more">Learn More</h2>

To learn more about Apollo, and how to use it in React, visit:

- [GraphQL.org](http://graphql.org) for an introduction to GraphQL,
- [Our website](http://www.apollostack.com/) to learn about the Apollo stack,
- [Our Medium blog](https://medium.com/apollo-stack) for detailed insights about GraphQL.
