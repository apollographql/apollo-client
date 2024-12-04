---
"@apollo/client": minor
---

Introduces data masking into Apollo Client. Data masking allows components to access only the data they asked for through GraphQL fragments. This prevents coupling between components that might otherwise implicitly rely on fields not requested by the component. Data masking also provides the benefit that masked fields only rerender components that ask for the field.

To enable data masking in Apollo Client, set the `dataMasking` option to `true`.

```ts
new ApolloClient({
  dataMasking: true,
  // ... other options
})
```

You can selectively disable data masking using the `@unmask` directive. Apply this to any named fragment to receive all fields requested by the fragment.

```graphql
query {
  user {
    id
    ...UserFields @unmask
  }
}
```

To help with migration, use the `@unmask` migrate mode which will add warnings when accessing fields that would otherwise be masked.

```graphql
query {
  user {
    id
    ...UserFields @unmask(mode: "migrate")
  }
}
```
