---
"@apollo/client": minor
---

Add support for arrays with `useFragment`, `useSuspenseFragment`, and `client.watchFragment`. This allows the ability to use a fragment to watch multiple entities in the cache. Passing an array to `from` will return `data` as an array where each array index corresponds to the index in the `from` array.

```ts
function MyComponent() {
  const result = useFragment({
    fragment,
    from: [item1, item2, item3]
  });

  // `data` is an array with 3 items
  console.log(result); // { data: [{...}, {...}, {...}], dataState: "complete", complete: true }
}
```
