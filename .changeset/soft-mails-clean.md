---
"@apollo/client": major
---

`useLazyQuery` no longer supports calling the execute function in render and will now throw. If you need to execute the query immediately, move the call to the execute function to `useEffect`.

```ts
function MyComponent() {
  const [execute, { loading, called }] = useLazyQuery(query);

  if (!loading && !called) {
    // This will now throw
    execute()
  }

  // Call the `execute` function in `useEffect` instead.
  useEffect(() => {
    execute();
  }, [execute]);

  // ...
}
```

NOTE: This change is limited to React 17 and 18.
