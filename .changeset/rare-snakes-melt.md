---
"@apollo/client": minor
---

Add the ability to start preloading a query outside React to begin fetching as early as possible. Call `createQueryPreloader` to create a `preloadQuery` function which can be called to start fetching a query. This returns a `queryRef` which is passed to `useReadQuery` and suspended until the query is done fetching.

```tsx
const preloadQuery = createQueryPreloader(client);
const queryRef = preloadQuery(QUERY, { variables, ...otherOptions });

function App() {
  return {
    <Suspense fallback={<div>Loading</div>}>
      <MyQuery />
    </Suspense>
  }
}

function MyQuery() {
  const { data } = useReadQuery(queryRef);

  // do something with data
}
```
