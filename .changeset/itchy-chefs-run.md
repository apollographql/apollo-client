---
"@apollo/client": major
---

When passing a `variables` key with the value `undefined`, the value will be replaced by the default value in the query, if it is provided, rather than leave it as `undefined`.

```ts
// given this query
const query = gql`
  query PaginatedQuery($limit: Int! = 10, $offset: Int) {
    list(limit: $limit, offset: $offset) {
      id
    }
  }
`

const observable = client.query({ query, variables: { limit: 5, offset: 0 }});
console.log(observable.variables) // => { limit: 5, offset: 0 }

observable.reobserve({ variables: { limit: undefined, offset: 10 }})
// limit is now `10`. This would previously be `undefined`
console.log(observable.variables) // => { limit: 10, offset: 10 }
```
