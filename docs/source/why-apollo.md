---
title: Why Apollo?
description: Why choose Apollo Client to manage your data?
---

You've probably stumbled upon this page because you're evaluating Apollo Client to manage your application's data. We're so excited you're here! Building out an app's data layer is no easy task, but we're hoping to help simplify the process for you.

The following examples will focus on React, but any of them can be applied to our Angular or Vue integrations since Apollo Client is decoupled from your view layer. That's another great feature of Apollo Client: No matter which library you're using on the front-end, you can take advantage of the entire Apollo ecosystem.

Show one example to illustrate all of these points (maybe list of movies --> click to detail page --> ability to favorite movies w/ local state). This will be the same example you use for the recipe example app. Call out to that page somewhere for a more detailed walkthrough of the code.

<h2 title="declarative-data">Declarative data fetching</h2>

- Show how easy it is to set up Apollo Client and make your first request
- Bind a query to your component, they update reactively
- No middleware to set up before you make your first request, just describe the data you want
- Optimistic mutations are built in

<h2 title="caching">Zero-config caching</h2>

- Out of the box, Apollo Client normalizes and caches your data for you
- We've spent two years determining the best way to cache a graph, since you can have multiple paths leading to the same data, normalization is essential
- No need to write selectors, your GraphQL queries are your selectors
- Show transition from movie list --> movie detail page. Features that are normally complicated to execute are trivial to build with Apollo

<h2 title="one-interface">Unified interface</h2>

- GraphQL as a unified interface to all your data
- With schema stitching, you can stitch together all of your GraphQL microservices, but you can also stitch together your local and remote data (show example of both local and remote schemas in dev tools)
- Show preview of apollo-link-state; components have multiple data sources (both local and remote); now you can request them together in one query

<h2 title="community">Vibrant ecosystem</h2>

- Apollo Client is easy to set up, but extensible for when you need to build out more advanced features
- Showcase community links, extensions that our community members have built
- Blog updated weekly with best practices, supportive community on Slack to help you get acclimated to the Apollo ecosystem
- Focus on developer experience with rich ecosystem of tools (devtools, launchpad, etc)

<h2 title="case-studies">Case studies</h2>

Companies ranging from enterprises to startups trust Apollo Client to power their most critical web & native applications. If you'd like to learn more about how transitioning to GraphQL and Apollo simplified their engineers' workflows and improved their products, check out these case studies:

- [The New York Times](https://open.nytimes.com/the-new-york-times-now-on-apollo-b9a78a5038c): Learn how The New York Times switched from Relay to Apollo & implemented features in their app such as SSR and persisted queries
- [Express](https://dev-blog.apollodata.com/changing-the-architecture-of-express-com-23c950d43323): Easy-to-use pagination with Apollo helped improve the Express eCommerce team's key product pages
- [Major League Soccer](https://dev-blog.apollodata.com/reducing-our-redux-code-with-react-apollo-5091b9de9c2a): MLS' switch from Redux to Apollo for state management enabled them to delete nearly all of their Redux code
- [Expo](https://dev-blog.apollodata.com/using-graphql-apollo-at-expo-4c1f21f0f115)
- insert some "case study" talks from GraphQL Summit

If your company is using Apollo Client in production, we'd love to feature a case study on our blog! Please get in touch via Slack so we can learn more about how you're using Apollo. Alternatively, if you already have a blog post or a conference talk that you'd like to feature here, please send in a PR.

