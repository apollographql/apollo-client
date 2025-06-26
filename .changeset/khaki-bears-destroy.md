---
"@apollo/client": major
_tags:
  - features
---

Adds enhanced client awareness to the client.

`HttpLink` and `BatchHttpLink` will now per default send information about the
client library you are using in `extensions`.

This could look like this:

```json
{
  "query": "query GetUser($id: ID!) { user(id: $id) { __typename id name } }",
  "variables": {
    "id": 5
  },
  "extensions": {
    "clientLibrary": {
      "name": "@apollo/client",
      "version": "4.0.0"
    }
  }
}
```

This feature can be disabled by passing `enhancedClientAwareness: { transport: false }` to your
`ApolloClient`,  `HttpLink` or `BatchHttpLink` constructor options.
