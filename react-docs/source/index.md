---
title: Introduction
---

This is the official guide to using GraphQL in your [React](https://facebook.github.io/react/) app with the [Apollo](http://apollostack.com) JavaScript GraphQL client and the [react-apollo](https://github.com/apollostack/react-apollo) integration package.

[Get started now with the setup instructions.](/react/initialization.html)

The Apollo community builds and maintains tools designed to make it easier to use [GraphQL](http://graphql.org) across a range of front-end and server technologies. Although this guide focuses on the integration with React, there is a similar [guide](/angular2) for Angular 2, and the [core](/core) `apollo-client` JavaScript package can be used anywhere JavaScript runs.

If you are looking to use Apollo with a native mobile client, there is a [iOS Client](https://github.com/apollostack/apollo-ios) in development and plans for an Android client too. On the other hand, the React integration documented here works with [React Native](https://facebook.github.io/react-native/) on both platforms without changes.

You can learn more about the Apollo project at the project's [home page](http://apollostack.com).

<h2 id="apollo-client">Apollo Client and React</h2>

The `apollo-client` npm module is a JavaScript client for GraphQL. The goal of the package is to be:

1. **Incrementally adoptable**, so that you can drop it into an existing JavaScript app and start using GraphQL for just part of your UI.
2. **Universally compatible**, so that Apollo works with any build setup, any GraphQL server, and any GraphQL schema.
2. **Simple to get started with**, you can just read this guide and get going.
3. **Inspectable and understandable**, so that you can have great developer tools to understand exactly what is happening in your app.
4. **Built for interactive apps**, so your users can make changes and see them reflected in the UI immediately.
5. **Community driven**, many of the components of Apollo (including the `react-apollo` integration) are driven by the community and serve real-world use cases from the outset, and all projects are planned and developed in the open.

The Apollo client does more than simply run your queries against your GraphQL server. It analyzes your queries and their results to construct a client-side cache of your data, which is kept up to date as further queries and mutations are run, fetching more results from the server. This means that your UI can be internally consistent and fully up-to-date with the state on the server with the minimum number of queries required.

The best way to use `apollo-client` in your React app is with `react-apollo`, a React-specific API that's designed to take full advantage of Apollo's features. The integration provides a natural "higher-order-component" API for queries and mutations, and will keep your rendered component tree up to date with the data in the cache seamlessly.

<h2 id="compatibility">Compatibility</h2>

Apollo is designed to work with many of the tools used in a typical React app. In particular:

- **React Native**: It's supported out of the box!
- **Redux**: Apollo client uses Redux internally, and you can [integrate it into your existing store](redux.html) to use your favorite Redux tools such as the dev tools or persistence libraries. You can also use it alongside any other data management library, such as MobX, without issues.
- **Router-independent**: You can use the library of your choice, such as React Router.
- **Any GraphQL server**: It doesn't matter if you use JavaScript, Ruby, Scala, or anything else to build your GraphQL server. Apollo works completely with standard GraphQL, and doesn't have any requirements for your server or schema design.

<h2 id="comparison">Comparison with other GraphQL clients</h2>

If you are deciding whether to use `react-apollo` or some other GraphQL client, it's worth considering the [goals](#apollo-client) of the project, and how they compare. In particular:

 - [Relay](https://facebook.github.io/relay/) is a performant, opinionated, React-specific GraphQL client built by Facebook for their mobile applications. It focuses on enabling the co-location of queries and components, and is opinionated about the design of your GraphQL schema, especially in the case of pagination. Apollo has an analogous set of features to Relay, but is designed to be a general-purpose tool that can be used with any schema or any frontend architecture. Relay's coupling to a specific kind of schema and architecture enables some benefits but with the loss of some flexibility, which also lets the Apollo community iterate more rapidly and quickly test experimental features.
 - [Lokka](https://github.com/kadirahq/lokka) is a simple GraphQL Javascript client with a basic query cache. Apollo is more complex, but includes a much more sophisticated cache and set of features around updating and refetching data.

<h2 id="learn-more">Learn More</h2>

To learn more about Apollo, and how to use it in React, visit:

- [GraphQL.org](http://graphql.org) for an introduction to GraphQL,
- [Our website](http://www.apollostack.com/) to learn about Apollo open source tools,
- [Our Medium blog](https://medium.com/apollo-stack) for detailed insights about GraphQL.
