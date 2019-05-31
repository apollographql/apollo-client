---
title: New in React Apollo 2.1
description: A guide to what's new in React Apollo 2.1
---

React Apollo was designed from the beginning to make using Apollo with React the easiest possible experience. For a long time, this meant using higher order components to configure and connect Apollo to your React application. With React Apollo 2.1, using the two together is easier and more natural than ever thanks to the brand new Apollo Components! 🚀

**Important**: The 2.1 version only introduces new features, it doesn't remove, break, or deprecate any existing usage of the `graphql` higher order component. You should be able to start using the new features as they make sense without worrying about a full rewrite of your app!

## The Query Component

Thinking in components is one of the many amazing things that React brings to teams building applications. With React Apollo 2.1, you can now easily manage your data just using components as well. It is incredibly simple to get started, all you need is a GraphQL query and the new `<Query />` component (note: this assumes you have setup the ApolloProvider in your tree).

```jsx
const GET_DOGS = gql`
  query GetDogs {
    dogs {
      id
      name
    }
  }
`;

const GoodDogsBrent = () => (
  <Query query={GET_DOGS}>
    {({ loading, error, data }) => {
      if (error) return <Error />
      if (loading || !data) return <Fetching />

      return <DogList dogs={data.dogs} />
    }}
  </Query>
)
```

### Upgrading from `graphql` to `<Query />`

You may love the Query component enough to start rewriting parts of your app to use it ([I know we do!](https://github.com/apollographql/GitHunt-React/pull/275)). Upgrading existing connected components is really easy! Let's take a look at what a refactor could look like:

First let's start with a graphql connected component that uses props for the fetchPolicy and passes the loading and currentUser to its wrapped component:

```jsx
const PROFILE_QUERY = gql`
  query GetUser {
    currentUser {
      firstName
    }
  }
`;

const Profile = ({ loading, currentUser }) => {
  if (loading) return <span>loading....</span>
  return <h1>Welcome back {currentUser.firstName}</h1>
}

export default graphql(PROFILE_QUERY, {
  options: ({ refetch }) => ({
    fetchPolicy: refetch ? 'cache-and-network' : 'cache-first',
  }),
  props: ({ data: { loading, currentUser } }) => ({
    loading,
    currentUser,
  }),
})(Profile)
```

Writing this with the Query component would look something like this:

```jsx
const PROFILE_QUERY = gql`
  query GetUser {
    currentUser {
      firstName
    }
  }
`;

const Profile = ({ refetch }) => (
  <Query
    query={PROFILE_QUERY}
    fetchPolicy={refetch ? 'cache-and-network': 'cache-first'}
  >
    {({ loading, data: { currentUser } }) => {
      if (loading) return <span>loading....</span>
      return <h1>Welcome back {currentUser.firstName}</h1>
    }}
  </Query>
);
```

And just like that we have the same UI but everything is a component!

### Updating multiple connected components with compose

In some cases, it may make sense to split your queries into different operations for reuse, better performance, and separation of concerns. In the past, to easily group all of those data requirements together meant using the `compose` function from React Apollo. Now, you can just compose them directly in your render function! Take a look at this simple example:

```jsx
const QueryOne = gql`
  query One {
    one
  }
`;

const QueryTwo = gql`
  query Two {
    two
  }
`;

const withOne = graphql(QueryOne, {
  props: ({ data }) => ({
    loadingOne: data.loading,
    one: data.one
  }),
});

const withTwo = graphql(QueryTwo, {
  props: ({ data }) => ({
    loadingTwo: data.loading,
    two: data.two
  }),
});

const Numbers = ({ loadingOne, loadingTwo, one, two }) => {
  if (loadingOne || loadingTwo) return <span>loading...</span>
  return <h3>{one} is less than {two}</h3>
};

const NumbersWithData = compose(withOne, withTwo)(Numbers);
```

Sure is a lot for a "simple" example right? Here is the same code using the new Query component:

```js
const QueryOne = gql`
  query One {
    one
  }
`;

const QueryTwo = gql`
  query Two {
    two
  }
`;

const NumbersWithData = () => (
  <Query query={QueryOne}>
    {({ loading: loadingOne, data: { one } }) => (
      <Query query={QueryTwo}>
        {({ loading: loadingTwo, data: { two }}) => {
          if (loadingOne || loadingTwo) return <span>loading...</span>
          return <h3>{one} is less than {two}</h3>
        }}
      </Query>
    )}
  </Query>
);
```

And just like that, we have two composed queries! To explore more migration examples, take a look at each individual commit on this [pull request](https://github.com/apollographql/GitHunt-React/pull/275). It shows a number of use cases being refactored to the new components.

For more information on how to use the new Query component, read the [full guide](/essentials/queries/)!

## The Mutation and Subscription Components

Much like the Query component, the Mutation and Subscription components are ways to use Apollo directly within your React tree. They simplify integrating with Apollo, and keep your React app written in React! For more information on the Mutation component, [check out the usage guide](/essentials/mutations/) or if you are wanting to learn about the Subscription component, [read how to here](/advanced/subscriptions/).

## ApolloConsumer

With upcoming versions of React (starting in React 16.3), there is a new version of context that makes it easier than ever to use components connected to state higher in the tree. While the 2.1 doesn't require React 16.3, we are making it easier than ever to start writing in this style with the `<ApolloConsumer>` component. This is just like the `withApollo` higher order component, just in a normal React component! It takes no props and expects a child function which receives the instance of Apollo Client in your tree. For example:

```jsx
const MyClient = () => (
  <ApolloConsumer>
    {(client) => (
      <div>
        <h1>The current cache is:</h1>
        <pre>{client.extract()}</pre>
      </div>
    )}
  </ApolloConsumer>
)
```

For more usage tips on the ApolloConsumer component, checkout the guide [here](/essentials/local-state/)
