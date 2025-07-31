---
"@apollo/client": major
---

The request handler provided to `ApolloLink` must now return an `Observable`. `null` is no longer supported as a valid return value. If you rely on `null` so that `ApolloLink` provides an empty observable, use the `EMPTY` observable from RxJS instead:

```diff
import { ApolloLink } from "@apollo/client";
+ import { EMPTY } from "rxjs";

const link = new ApolloLink((operation, forward) => {
- return null;
+ return EMPTY;
});
```
