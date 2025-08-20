---
"@apollo/client": patch
---

The individual `empty`, `concat`, `from` and `split` functions exported from `@apollo/client/link` are now deprecated in favor of using the static functions instead.

```diff
import {
  ApolloLink,
- concat,
- empty,
- from,
- split,
} from "@apollo/client/link";

- concat(first, second);
+ ApolloLink.concat(first, second);

- empty();
+ ApolloLink.empty();

- from([first, second]);
+ ApolloLink.from([first, second]);

- split(
+ ApolloLink.split(
  (operation) => /* */,
  first,
  second
);
```
