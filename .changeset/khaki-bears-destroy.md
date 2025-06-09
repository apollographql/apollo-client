---
"@apollo/client": major
---

New feature: Enhanced Client Awareness

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

This feature can be disabled by passing `enhancedClientAwareness: false` to your
`HttpLink` or `BatchHttpLink` constructor options.

If you want to save the bundle size of this feature, you can use `BaseHttpLink`
or `BaseBatchHttpLink` instead - these links come without the `ClientAwarenessLink`
included (keep in mind that this will also disable the "client awareness" feature).
