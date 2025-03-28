---
"@apollo/client": major
---

`useLazyQuery` no longer supports `variables` in the hook options and therefore no longer performs variable merging. The execute function must now be called with `variables` instead.

```ts
function MyComponent() {
  const [execute] = useLazyQuery(query);

  function runExecute() {
    execute({ variables: { ... }});
  }
}
```

This change means the execute function returned from `useLazyQuery` is more type-safe. The execute function will require you to pass a `variables` option if the query type includes required variables.
