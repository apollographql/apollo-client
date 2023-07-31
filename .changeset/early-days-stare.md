---
'@apollo/client': minor
---

Adds support for a `skipToken` sentinel that can be used as `options` in `useSuspenseQuery` and `useBackgroundQuery` to skip execution of a query. This works identically to the `skip` option but is more type-safe and as such, becomes the recommended way to skip query execution. As such, the `skip` option has been deprecated in favor of `skipToken`.

We are considering the removal of the `skip` option from `useSuspenseQuery` and `useBackgroundQuery` in the next major. We are releasing with it now to make migration from `useQuery` easier and make `skipToken` more discoverable.

```ts
import { skipToken } from '@apollo/client';

const id: number | undefined;

const { data } = useSuspenseQuery(
  query, 
  id ? { variables: { id } } : skipToken
);
```

### Breaking change

Previously `useBackgroundQuery` would always return a `queryRef` whenever query execution was skipped. This behavior been updated to return a `queryRef` only when query execution is enabled. If initializing the hook with it skipped, `queryRef` is now returned as `undefined`.

To migrate, conditionally render the component that accepts the `queryRef` as props.

**Before**
```ts
function Parent() {
  const [queryRef] = useBackgroundQuery(query, skip ? skipToken : undefined);
  //      ^? QueryReference<TData | undefined>

  return <Child queryRef={queryRef} />
}

function Child({ queryRef }: { queryRef: QueryReference<TData | undefined> }) {
  const { data } = useReadQuery(queryRef);
}
```

**After**
```ts
function Parent() {
  const [queryRef] = useBackgroundQuery(query, skip ? skipToken : undefined);
  //      ^? QueryReference<TData> | undefined

  return queryRef ? <Child queryRef={queryRef} /> : null;
}

function Child({ queryRef }: { queryRef: QueryReference<TData> }) {
  const { data } = useReadQuery(queryRef);
}
```
