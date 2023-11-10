---
"@apollo/client": minor
---

Introduces a new `useLoadableQuery` hook. This hook works similarly to `useBackgroundQuery` in that it returns a `queryRef` that can be used to suspend a component via the `useReadQuery` hook. It provides a more ergonomic way to load the query during a user interaction (for example when wanting to preload some data) that would otherwise be clunky with `useBackgroundQuery`.

```tsx
function App() {
  const [queryRef, loadQuery, { refetch, fetchMore }] = useLoadableQuery(query, options)

  return (
    <>
      <button onClick={() => loadQuery(variables)>Load query</button>
      {queryRef && <Child queryRef={queryRef} />}
    </>
  );
}

function Child({ queryRef }) {
  const { data } = useReadQuery(queryRef)

  // ...
}
```
