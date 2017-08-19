---
title: Query Splitting
---

Prefetching is an easy way to make your applications UI feel faster. You can use mouse events to predict the data that could be needed.
This is powerful and works perfectly on the browser, but can not be applied to a mobile device.

One solution for improving the UI experience would be the usage of fragments to preload more data in a query, but loading huge amounts of data (that you probably never show to the user) is expensive.

An other way would be the splitting of huge queries into two smaller queries:
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
query seriesOverviewData {
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
query seriesDetailData($seriesId: Int!) {
  oneSeries(id: $seriesId) {
    id
    title
    description
    cover
  }
}
```

```graphql
query seriesEpisodes($seriesId: Int!) {
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

By adding a [custom resolver](cache-updates.html#cacheRedirect) for the `oneSeries` field (and having dataIdFromObject function which normalizes the cache), the data can be resolved instantly from the store without a server round trip.

```javascript
import ApolloClient, { toIdValue } from 'apollo-client'

// ... your NetworkInterface declaration
// and also VERY important: Your dataIdFromObject declaration


const client = new ApolloClient({
  networkInterface,
  customResolvers: {
    Query: {
      oneSeries: (_, { id }) => toIdValue(dataIdFromObject({ __typename: 'Series', id })),
    },
  },
  dataIdFromObject,
})
```

A component for the second view that implements the two queries could look like this:
```jsx
import React, { PropTypes, } from 'react'
import { gql, graphql, compose, } from 'react-apollo'

const QUERY_SERIES_DETAIL_VIEW = gql`
  query seriesDetailData($seriesId: Int!) {
    oneSeries(id: $seriesId) {
      id
      title
      description
      cover
    }
  }
`

const QUERY_SERIES_EPISODES = gql`
  query seriesEpisodes($seriesId: Int!) {
    oneSeries(id: $seriesId) {
      id
      episodes {
        id
        title
        cover
      }
    }
  }
`
const options = ({ seriesId, }) => ({ variables: { seriesId, }, })

const withSeriesDetailData = graphql(QUERY_SERIES_DETAIL_VIEW, {
  name: `seriesDetailData`,
  options,
})

const withSeriesEpisodes = graphql(QUERY_SERIES_EPISODES, {
  name: `seriesWithEpisodesData`,
  options,
})

const withData = compose(
  withSeriesDetailData,
  withSeriesEpisodes
)

function SeriesDetailView({ 
  seriesDetailData: {
    loading: seriesLoading,
    oneSeries,
  },
  seriesWithEpisodesData: { 
    loading: episodesLoading,
    oneSeries: { episodes } = {},
  }
}) {
  return (
    <div>
      <h1>{seriesLoading ? `Loading...` : oneSeries.title}</h1>
      <img src={seriesLoading ? `/dummy.jpg` : oneSeries.cover} />
      <h2>Episodes</h2>
      <ul>
      {episodesLoading ? <li>Loading...</li> : episodes.map(episode => (
        <li key={episode.id}>
          <img src={episode.cover} />
          <a href={`/episode/${episode.id}`}>{episode.title}</a>
        </li>
      ))}
      </ul>
    </div>
  )
}

const SeriesDetailViewWithData = withData(SeriesDetailView)

SeriesDetailViewWithData.propTypes = {
  seriesId: PropTypes.number.isRequired,
}

export default SeriesDetailView

```

Unfortunately if the user would now visit the second view without ever visiting the first view this would result in two network requests (since the data for the first query is not in the store yet). By using a [`BatchedNetworkInterface`](/core/apollo-client-api.html#BatchedNetworkInterface) those two queries can be send to the server in one network request.
