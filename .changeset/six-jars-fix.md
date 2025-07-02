---
"@apollo/client": major
_tags:
  - removals
  - createQueryPreloader
---

`queryRef`s created by `preloadQuery` no longer have a `.toPromise()` function. Instead `preloadQuery` now has a `toPromise` function that accepts a queryRef and will resolve when the underlying promise has been resolved.

```diff
const queryRef = preloadQuery(query, options);

- await queryRef.toPromise();
+ await preloadQuery.toPromise(queryRef);
```
