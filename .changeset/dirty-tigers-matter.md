---
"@apollo/client": minor
---

Create a new `useQueryRefHandlers` hook that returns `refetch` and `fetchMore` functions for a given `queryRef`. This is useful to get access to handlers for a `queryRef` that was created by `createQueryPreloader` or when the handlers for a `queryRef` produced by a different component are inaccessible.

```jsx
const MyComponent({ queryRef }) {
  const { refetch, fetchMore } = useQueryRefHandlers(queryRef);

  // ...
}
```
