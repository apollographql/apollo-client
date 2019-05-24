---
title: Improving performance
---

## Redirecting to cached data

In some cases, a query requests data that already exists in the client store under a different key. A very common example of this is when your UI has a list view and a detail view that both use the same data. The list view might run the following query:

```graphql
query ListView {
  books {
    id
    title
    abstract
  }
}
```

When a specific book is selected, the detail view displays an individual item using this query:

```graphql
query DetailView {
  book(id: $id) {
    id
    title
    abstract
  }
}
```

> Note: The data returned by the list query has to include all the data the specific query needs. If the specific book query fetches a field that the list query doesn't return Apollo Client cannot return the data from the cache.

We know that the data is most likely already in the client cache, but because it's requested with a different query, Apollo Client doesn't know that. In order to tell Apollo Client where to look for the data, we can define custom resolvers:

```js
import { toIdValue } from 'apollo-utilities';
import { InMemoryCache } from 'apollo-cache-inmemory';

const cache = new InMemoryCache({
  cacheRedirects: {
    Query: {
      book: (_, args) => toIdValue(cache.config.dataIdFromObject({ __typename: 'Book', id: args.id })),
    },
  },
});
```

> Note: This'll also work with custom `dataIdFromObject` methods as long as you use the same one.

Apollo Client will use the return value of the custom resolver to look up the item in its cache. `toIdValue` must be used to indicate that the value returned should be interpreted as an id, and not as a scalar value or an object. "Query" key in this example is your root query type name.

To figure out what you should put in the `__typename` property run one of the queries in GraphiQL and get the `__typename` field:

```graphql
query ListView {
  books {
    __typename
  }
}

# or

query DetailView {
  book(id: $id) {
    __typename
  }
}
```

The value that's returned (the name of your type) is what you need to put into the `__typename` property.

It is also possible to return a list of IDs:

```js
cacheRedirects: {
  Query: {
    books: (_, args) => args.ids.map(id =>
      toIdValue(cache.config.dataIdFromObject({ __typename: 'Book', id: id }))),
  },
},
```

## Prefetching data

Prefetching is one of the easiest ways to make your application's UI feel a lot faster with Apollo Client. Prefetching simply means loading data into the cache before it needs to be rendered on the screen. Essentially, we want to load all data required for a view as soon as we can guess that a user will navigate to it.

We can accomplish this in only a few lines of code by calling `client.query` whenever the user hovers over a link. Let's see this in action in the `Feed` component in our example app [Pupstagram](https://codesandbox.io/s/r5qp83z0yq).

```jsx
const Feed = () => (
  <View style={styles.container}>
    <Header />
    <Query query={GET_DOGS}>
      {({ loading, error, data, client }) => {
        if (loading) return <Fetching />;
        if (error) return <Error />;

        return (
          <DogList
            data={data.dogs}
            renderRow={(type, data) => (
              <Link
                to={{
                  pathname: `/${data.breed}/${data.id}`,
                  state: { id: data.id }
                }}
                onMouseOver={() =>
                  client.query({
                    query: GET_DOG,
                    variables: { breed: data.breed }
                  })
                }
                style={{ textDecoration: "none" }}
              >
                <Dog {...data} url={data.displayImage} />
              </Link>
            )}
          />
        );
      }}
    </Query>
  </View>
);
```

All we have to do is access the client in the render prop function and call `client.query` when the user hovers over the link. Once the user clicks on the link, the data will already be available in the Apollo cache, so the user won't see a loading state.

There are a lot of different ways to anticipate that the user will end up needing some data in the UI. In addition to using the hover state, here are some other places you can preload data:

1. The next step of a multi-step wizard immediately
2. The route of a call-to-action button
3. All of the data for a sub-area of the application, to make navigating within that area instant

If you have some other ideas, please send a PR to this article, and maybe add some more code snippets. A special form of prefetching is [store hydration from the server](/features/server-side-rendering/#store-rehydration), so you might also consider hydrating more data than is actually needed for the first page load to make other interactions faster.

## Query splitting

Prefetching is an easy way to make your applications UI feel faster. You can use mouse events to predict the data that could be needed.
This is powerful and works perfectly on the browser, but can not be applied to a mobile device.

One solution for improving the UI experience would be the usage of fragments to preload more data in a query, but loading huge amounts of data (that you probably never show to the user) is expensive.

Another solution would be to split huge queries into two smaller queries:

- The first one could load data which is already in the store. This means that it can be displayed instantly.
- The second query could load data which is not in the store yet and must be fetched from the server first.

This solution gives you the benefit of not fetching too much data, as well as the possibility to show some part of the views data before the server responds.

Lets say you have the following schema:

```graphql
type Series {
  id: Int!
  title: String!
  description: String!
  episodes: [Episode]!
  cover: String!
}

type Episode {
  id: Int!
  title: String!
  cover: String!
}

type Query {
  series: [Series!]!
  oneSeries(id: Int): Series
}
```

And you have two Views:

1. Series Overview: List of all Series with their description and cover
2. Series DetailView: Detail View of a Series with its description, cover and a list of episodes

The query for the Series Overview would look like the following:

```graphql
query SeriesOverviewData {
  series {
    id
    title
    description
    cover
  }
}
```

The queries for the Series DetailView would look like this:

```graphql
query SeriesDetailData($seriesId: Int!) {
  oneSeries(id: $seriesId) {
    id
    title
    description
    cover
  }
}
```

```graphql
query SeriesEpisodes($seriesId: Int!) {
  oneSeries(id: $seriesId) {
    id
    episodes {
      id
      title
      cover
    }
  }
}
```

By adding a [custom resolver](/advanced/caching/#cache-redirects-with-cacheredirects) for the `oneSeries` field (and having dataIdFromObject function which normalizes the cache), the data can be resolved instantly from the store without a server round trip.

```javascript
import { ApolloClient } from 'apollo-client';
import { toIdValue } from 'apollo-utilities';
import { InMemoryCache } from 'apollo-cache-inmemory';

const cache = new InMemoryCache({
  cacheResolvers: {
    Query: {
      oneSeries: (_, { id }) => toIdValue(cache.config.dataIdFromObject({ __typename: 'Series', id })),
    },
  },
  dataIdFromObject,
})

const client = new ApolloClient({
  link, // your link,
  cache,
})
```

A component for the second view that implements the two queries could look like this:

```jsx
const QUERY_SERIES_DETAIL_VIEW = gql`
  query SeriesDetailData($seriesId: Int!) {
    oneSeries(id: $seriesId) {
      id
      title
      description
      cover
    }
  }
`;

const QUERY_SERIES_EPISODES = gql`
  query SeriesEpisodes($seriesId: Int!) {
    oneSeries(id: $seriesId) {
      id
      episodes {
        id
        title
        cover
      }
    }
  }
`;

const SeriesDetailView = ({ seriesId }) => (
  <Query query={QUERY_SERIES_DETAIL_VIEW} variables={{ seriesId }}>
    {({ loading: seriesLoading, data: { oneSeries } }) => (
      <Query query={QUERY_SERIES_EPISODES} variables={{ seriesId }}>
        {({
          loading: episodesLoading,
          data: { oneSeries: { episodes } = {} }
        }) => (
          <div>
            <h1>{seriesLoading ? `Loading...` : oneSeries.title}</h1>
            <img src={seriesLoading ? `/dummy.jpg` : oneSeries.cover} />
            <h2>Episodes</h2>
            <ul>
              {episodesLoading ? (
                <li>Loading...</li>
              ) : (
                episodes.map(episode => (
                  <li key={episode.id}>
                    <img src={episode.cover} />
                    <a href={`/episode/${episode.id}`}>{episode.title}</a>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </Query>
    )}
  </Query>
);
```

Unfortunately if the user would now visit the second view without ever visiting the first view this would result in two network requests (since the data for the first query is not in the store yet). By using a [`BatchedHttpLink`](https://www.apollographql.com/docs/link/links/batch-http) those two queries can be send to the server in one network request.
