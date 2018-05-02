---
title: Why Apollo Client?
description: Why choose Apollo Client to manage your data?
---

Data management shouldn't have to be so difficult! If you're wondering how to simplify managing remote and local data in your React application, then you've come to the right place. Through practical examples inspired by our [example app Pupstagram](https://codesandbox.io/s/r5qp83z0yq), you'll learn how Apollo's intelligent caching and declarative approach to data fetching can help you iterate faster while writing less code. Let's jump right in! 🚀

<h2 id="declarative-data">Declarative data fetching</h2>

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

Here we're using a Query component to fetch some dogs from our GraphQL server and display them in a list. The Query component uses the React [render prop API](https://reactjs.org/docs/render-props.html) (with a function as a child) to bind a query to our component and render it based on the results of our query. Once our data comes back, our `<DogList />` component will update reactively with the data it needs.

Apollo Client takes care of the request cycle from start to finish, including tracking loading and error states for you. There's no middleware to set up or boilerplate to write before making your first request, nor do you need to worry about transforming and caching the response. All you have to do is describe the data your component needs and let Apollo Client do the heavy lifting. 💪

You'll find that when you switch to Apollo Client, you'll be able to delete a lot of unnecessary code related to data management. The exact amount will vary depending on your application, but some teams have reported up to thousands of lines. While you'll find yourself writing less code with Apollo, that doesn't mean you have to compromise on features! Advanced features like optimistic UI, refetching, and pagination are all easily accessible from the Query component props.

<h2 id="caching">Zero-config caching</h2>

One of the key features that sets Apollo Client apart from other data management solutions is its normalized cache. Just by setting up Apollo Client, you get an intelligent cache out of the box with no additional configuration required. From the home page of the [Pupstagram example app](https://codesandbox.io/s/r5qp83z0yq), click one of the dogs to see its detail page. Then, go back to the home page. You'll notice that the images on the home page load instantaneously, thanks to the Apollo cache.

```js
import ApolloClient from 'apollo-boost';

// the Apollo cache is set up automatically
const client = new ApolloClient();
```

Caching a graph is no easy task, but we've spent two years focused on solving it. Since you can have multiple paths leading to the same data, normalization is essential for keeping your data consistent across multiple components. Let's look at some practical examples:

```js
const GET_ALL_DOGS = gql`
  query {
    dogs {
      id
      breed
      displayImage
    }
  }
`;

const UPDATE_DISPLAY_IMAGE = gql`
  mutation updateDisplayImage($id: String!, $displayImage: String!) {
    updateDisplayImage(id: $id, displayImage: $displayImage) {
      id
      displayImage
    }
  }
`;
```

The query, `GET_ALL_DOGS`, fetches a list of dogs and their `displayImage`. The mutation, `UPDATE_DISPLAY_IMAGE`, updates a single dog's `displayImage`. If we update the `displayImage` on a specific dog, we also need that item on the list of all dogs to reflect the new data. Apollo Client splits out each object in a GraphQL result with a `__typename` and an `id` property into its own entry in the Apollo cache. This guarantees that returning a value from a mutation with an id will automatically update any queries that fetch the object with the same id. It also ensures that two queries which return the same data will always be in sync.

Features that are normally complicated to execute are trivial to build with the Apollo cache. Let's go back to our `GET_ALL_DOGS` query from the previous example that displays a list of dogs. What if we want to transition to a detail page for a specific dog? Since we've already fetched information on each dog, we don't want to refetch the same information from our server. With cache redirects, the Apollo cache lets us connect the dots between two queries so we don't have to fetch information that we know is already available.

Here's what our query for one dog looks like:

```js
const GET_DOG = gql`
  query {
    dog(id: "abc") {
      id
      breed
      displayImage
    }
  }
`;
```

Here's our cache redirect, which we can set up easily by specifying a map on the `cacheRedirects` property of the `apollo-boost` client. The cache redirect returns a key that the query can use to look up the data in the cache.

```js
import ApolloClient from 'apollo-boost';

const client = new ApolloClient({
  cacheRedirects: {
    Query: {
      dog: (_, { id }, { getCacheKey }) => getCacheKey({ id, __typename: 'Dog' })
    }
  }
})
```

<h2 id="combine-data">Combine local & remote data</h2>

Thousands of developers have told us that Apollo Client excels at managing remote data, which equates to roughly 80% of their data needs. But what about local data (like global flags and device API results) that make up the other 20% of the pie? This is where `apollo-link-state` comes in, our solution for local state management that allows you to use your Apollo cache as the single source of truth for data in your application.

Managing all your data with Apollo Client allows you to take advantage of GraphQL as a unified interface to all of your data. This enables you to inspect both your local and remote schemas in Apollo DevTools through GraphiQL.

```js
const GET_DOG = gql`
  query getDogByBreed($breed: String!) {
    dog(breed: $breed) {
      images {
        url
        id
        isLiked @client
      }
    }
  }
`;
```

With `apollo-link-state`, you can add client-side only fields to your remote data seamlessly and query them from your components. In this example, we're querying the client-only field `isLiked` alongside our server data. Your components are made up of local and remote data, now your queries can be too!

<h2 id="ecosystem">Vibrant ecosystem</h2>

Apollo Client is easy to get started with, but extensible for when you need to build out more advanced features. If you need custom functionality that isn't covered with `apollo-boost`, such as app-specific middleware or cache persistence, you can create your own client by plugging in an Apollo cache and chaining together your network stack with Apollo Link.

This flexibility makes it simple to create your dream client by building extensions on top of Apollo. We're always really impressed by what our contributors have built on top of Apollo - check out some of their packages:
- [Apollo Link community links](/docs/link/links/community.html): Pluggable links created by the community
- [apollo-cache-persist](https://dev-blog.apollodata.com/announcing-apollo-cache-persist-cb05aec16325): Simple persistence for your Apollo cache ([@jamesreggio](https://github.com/jamesreggio))
- [apollo-storybook-decorator](https://github.com/abhiaiyer91/apollo-storybook-decorator): Wrap your React Storybook stories with Apollo Client ([@abhiaiyer91](https://github.com/abhiaiyer91))
- [AppSync by AWS](https://dev-blog.apollodata.com/aws-appsync-powered-by-apollo-df61eb706183): Amazon's real-time GraphQL client uses Apollo Client under the hood

When you choose Apollo to manage your data, you also gain the support of our amazing community. There are over 5000 developers on our [Apollo Slack](https://www.apollographql.com/#slack) channel for you to share ideas with. You can also read articles on best practices and our announcements on the [Apollo blog](https://dev-blog.apollodata.com/), updated weekly.

<h2 id="case-studies">Case studies</h2>

Companies ranging from enterprises to startups trust Apollo Client to power their most critical web & native applications. If you'd like to learn more about how transitioning to GraphQL and Apollo simplified their engineers' workflows and improved their products, check out these case studies:

- [The New York Times](https://open.nytimes.com/the-new-york-times-now-on-apollo-b9a78a5038c): Learn how The New York Times switched from Relay to Apollo & implemented features in their app such as SSR and persisted queries
- [Express](https://dev-blog.apollodata.com/changing-the-architecture-of-express-com-23c950d43323): Easy-to-use pagination with Apollo helped improve the Express eCommerce team's key product pages
- [Major League Soccer](https://dev-blog.apollodata.com/reducing-our-redux-code-with-react-apollo-5091b9de9c2a): MLS' switch from Redux to Apollo for state management enabled them to delete nearly all of their Redux code
- [Expo](https://dev-blog.apollodata.com/using-graphql-apollo-at-expo-4c1f21f0f115): Developing their React Native app with Apollo allowed the Expo engineers to focus on improving their product instead of writing data fetching logic
- [KLM](https://youtu.be/T2njjXHdKqw): Learn how the KLM team scaled their Angular app with GraphQL and Apollo

If your company is using Apollo Client in production, we'd love to feature a case study on our blog! Please get in touch via Slack so we can learn more about how you're using Apollo. Alternatively, if you already have a blog post or a conference talk that you'd like to feature here, please send in a PR.
