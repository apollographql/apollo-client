# Example
> Use `create-react-app` then `yarn add apollo-client-preset react-apollo graphql` and replace below code for `index.js`
```js
import * as React from 'react'
import { render } from 'react-dom'

import ApolloClient from 'apollo-client'
import { HttpLink, InMemoryCache } from 'apollo-client-preset'
import { ApolloProvider, graphql } from 'react-apollo'
import gql from 'graphql-tag'

// Apollo client
const client = new ApolloClient({
  link: new HttpLink({ uri: 'https://api.graph.cool/simple/v1/cixos23120m0n0173veiiwrjr' }),
  cache: new InMemoryCache().restore({})
})

// Example query from https://www.graph.cool/
const MOVIE_QUERY = gql`
{
  Movie(id: "cixos5gtq0ogi0126tvekxo27") {
    id
    title
    actors {
       name
    }
  }
}
`

// Our App
const App = graphql(MOVIE_QUERY)(({ data }) => {
  const { loading, Movie } = data
  // Loading
  if (loading) return <div>loading...</div>
  
  // Loaded
  return <p><b>{Movie.title}</b> : {Movie.actors.map(({ name }) => name).join(', ')}</p>
})

const ApolloApp = (
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
)

render(ApolloApp, document.getElementById('root'))
```
