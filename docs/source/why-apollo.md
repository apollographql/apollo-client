---
title: Why Apollo?
description: Why choose Apollo Client to manage your data?
---

<h2 title="declarative-data">Declarative data fetching</h2>

With Apollo's declarative approach to data fetching, all of the logic for retrieving your data, tracking loading and error states, and updating your UI is encapsulated in a single Query component. This encapsulation makes composing your Query components with your presentational components a breeze! Let's see what this looks like in practice with React Apollo:

```js
const Feed = () => (
  <Query query={GET_DOGS}>
    {({ loading, error, data }) => {
      if (error) return <Error />
      if (loading || !data) return <Fetching />;

      return <DogList dogs={data.dogs} />
    }}
  </Query>
)
```

Here we're using a Query component to fetch some dogs from our GraphQL server and display them in a list. The Query component uses the render prop API (with a function as a child) to bind a query to our component and render it based on the results of our query. Once our data comes back, our `<DogList />` component will update reactively with the data it needs.

Apollo Client takes care of the request cycle from start to finish, including tracking loading and error states for you. There's no middleware to set up or boilerplate to write before making your first request, nor do you need to worry about transforming and caching the response. All you have to do is describe the data your component needs and let Apollo Client do the heavy lifting. 💪

You'll find that when you switch to Apollo Client, you'll be able to delete a lot of unnecessary code related to data management. The exact amount will vary depending on your application, but some teams have reported up to thousands of lines. While you'll find yourself writing less code with Apollo, that doesn't mean you have to compromise on features! Advanced features like optimistic UI, refetching, and pagination are all easily accessible from the Query component props.

<h2 title="caching">Zero-config caching</h2>

One of the bene

- Out of the box, Apollo Client normalizes and caches your data for you
- We've spent two years determining the best way to cache a graph, since you can have multiple paths leading to the same data, normalization is essential
- No need to write selectors, your GraphQL queries are your selectors
- Show transition from movie list --> movie detail page. Features that are normally complicated to execute are trivial to build with Apollo

<h2 title="combine-data">Combine local & remote data</h2>

- GraphQL as a unified interface to all your data
- With schema stitching, you can stitch together all of your GraphQL microservices, but you can also stitch together your local and remote data (show example of both local and remote schemas in dev tools)
- Show preview of apollo-link-state; components have multiple data sources (both local and remote); now you can request them together in one query

<h2 title="ecosystem">Vibrant ecosystem</h2>

Apollo Client is easy to get started with, but extensible for when you need to build out more advanced features. If you need custom functionality that isn't covered with `apollo-boost`, such as app-specific middleware or cache persistence, you can create your own client by plugging in an Apollo cache and chaining together your network stack with Apollo Link.

This flexibility makes it simple to create your dream client by building extensions on top of Apollo. We're always really impressed by what our contributors have built on top of Apollo - check out some of their packages:
- [Apollo Link community links](docs/link/links/community.html): Pluggable links created by the community
- [apollo-cache-persist](https://dev-blog.apollodata.com/announcing-apollo-cache-persist-cb05aec16325): Simple persistence for your Apollo cache ([@jamesreggio](https://github.com/jamesreggio))
- [apollo-storybook-decorator](https://github.com/abhiaiyer91/apollo-storybook-decorator): Wrap your React Storybook stories with Apollo Client ([@abhiaiyer91](https://github.com/abhiaiyer91))
- [AppSync by AWS](https://dev-blog.apollodata.com/aws-appsync-powered-by-apollo-df61eb706183): Amazon's real-time GraphQL client uses Apollo Client under the hood

When you choose Apollo to manage your data, you also gain the support of our amazing community. There are over 5000 developers on our Apollo Slack channel who can help you get acclimated to the Apollo ecosystem. You can also read articles on best practices and our announcements on the Apollo blog, updated weekly.


- Apollo Client is easy to set up, but extensible for when you need to build out more advanced features
- Showcase community links, extensions that our community members have built
- Blog updated weekly with best practices, supportive community on Slack to help you get acclimated to the Apollo ecosystem
- Focus on developer experience with rich ecosystem of tools (devtools, launchpad, etc)

<h2 title="case-studies">Case studies</h2>

Companies ranging from enterprises to startups trust Apollo Client to power their most critical web & native applications. If you'd like to learn more about how transitioning to GraphQL and Apollo simplified their engineers' workflows and improved their products, check out these case studies:

- [The New York Times](https://open.nytimes.com/the-new-york-times-now-on-apollo-b9a78a5038c): Learn how The New York Times switched from Relay to Apollo & implemented features in their app such as SSR and persisted queries
- [Express](https://dev-blog.apollodata.com/changing-the-architecture-of-express-com-23c950d43323): Easy-to-use pagination with Apollo helped improve the Express eCommerce team's key product pages
- [Major League Soccer](https://dev-blog.apollodata.com/reducing-our-redux-code-with-react-apollo-5091b9de9c2a): MLS' switch from Redux to Apollo for state management enabled them to delete nearly all of their Redux code
- [Expo](https://dev-blog.apollodata.com/using-graphql-apollo-at-expo-4c1f21f0f115): Developing their React Native app with Apollo allowed the Expo engineers to focus on improving their product instead of writing data fetching logic
- [KLM](https://youtu.be/T2njjXHdKqw): Learn how the KLM team scaled their Angular app with GraphQL and Apollo

If your company is using Apollo Client in production, we'd love to feature a case study on our blog! Please get in touch via Slack so we can learn more about how you're using Apollo. Alternatively, if you already have a blog post or a conference talk that you'd like to feature here, please send in a PR.
