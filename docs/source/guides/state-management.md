---
title: State Management
description: Managing your local and remote state in a GraphQL world
---

Not only is state management one of the most important aspects of building the front-end for your application, it's also one of the most challenging. With a REST and Redux workflow, you're writing action creators, reducers, and selectors for each network request. For a production-level app, you're also juggling several middleware packages for features like optimistic updates and manually normalizing your data.

With a GraphQL and Apollo workflow, you just write queries and let Apollo Client take care of the rest. Apollo Client normalizes and caches your data out of the box with zero configuration. It also enables you to execute complicated features such as optimistic UI, polling, and pagination with only a few lines of code.

If we're using Apollo Client to manage our remote data, then what do we do with local data such as boolean flags and device API information that we'd like to access globally? This is where [`apollo-link-state`](/docs/react/essentials/local-state.html) comes in, our solution for local state management that allows you to use your Apollo cache as the single source of truth for data in your application. We recommend managing all of your local and remote data with Apollo Client so GraphQL becomes a unified interface to all of your application's data.

The following sections outline some tips to help you make the most of your transition to managing all of your state with Apollo Client.

<h2 id="colocate">Colocate queries with components</h2>

When you first start building `Query` components for your GraphQL data, it can be tempting to dump all of your queries in one file similar to how developers using Redux put all of their reducers in a single file. Instead, we recommend that you colocate your GraphQL queries with the `Query` components that are using them. One of the greatest strengths of GraphQL is its declarative approach to data fetching, which you lose when you have to switch back to another file in order to determine what the shape of your data prop looks like:

```jsx
const GET_DOG_PHOTO = gql`
  query dog($breed: String!) {
    dog(breed: $breed) {
      id
      displayImage
    }
  }
`;

const DogPhoto = ({ breed }) => (
  <Query query={GET_DOG_PHOTO} variables={{ breed }}>
    {({ loading, error, data }) => {
      if (loading) return null;
      if (error) return `Error!: ${error}`;

      return (
        <img src={data.dog.displayImage} />
      );
    }}
  </Query>
);
```

In this example, we place our `GET_DOG_PHOTO` query next to our `DogPhoto` component and wrap it with the `gql` function. Now in the render prop function for `Query`, we know exactly what properties live on `data` and can use them to render our UI.

<h2 id="data-transformation">Move data transformation to the backend</h2>

Your GraphQL schema should always reflect how you're consuming the data on the front-end. This is why we recommend that [product teams own the design](../fundamentals/tips.html#schema) of their GraphQL schema. Shifting to this mentality is a bit of a departure from REST, where front-end developers consume APIs dictated by the backend team and often have to filter and sort the data into the shape their UI components expect.

If you find yourself sorting or filtering the data you receive back from your GraphQL API, it's probably a sign that you need to move that logic to your resolvers instead. Moving filtering and sorting logic to the backend ensures that you can share it across platforms easily instead of duplicating these efforts for every client.

**Instead of this:**
```jsx
const GET_MOVIES = gql`
  {
    movies {
      id
      title
      popularity
      score
    }
  }
`;

const PopularMovies = () => (
  <Query query={GET_MOVIES}>
    {({ loading, error, data }) => {
      if (loading) return null;
      if (error) return `Error!: ${error}`;

      const popularMovies = data.movies.sort((a, b) => {
        return b.popularity - a.popularity;
      });

      return <Movies movies={popularMovies} />
    }}
  </Query>
);
```

**Do this:**

```jsx
const GET_MOVIES = gql`
  {
    movies(sort: POPULARITY) {
      id
      title
      popularity
      score
    }
  }
`;

const PopularMovies = () => (
  <Query query={GET_MOVIES}>
    {({ loading, error, data }) => {
      if (loading) return null;
      if (error) return `Error!: ${error}`;

      return <Movies movies={data.movies} />
    }}
  </Query>
);
```

<h2 id="combine-data">Combine local and remote data</h2>

With `apollo-link-state`, you can add virtual fields to your remote data seamlessly and query them from your components by specifying a `@client` directive. In this example, we’re querying the client-only field isLiked alongside our server data. Your components are made up of local and remote data, now your queries can be too! This is one of the main advantages for using Apollo Client to manage all of your application's data.

```graphql
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