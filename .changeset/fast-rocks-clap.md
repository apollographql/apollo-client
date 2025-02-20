---
"@apollo/client": major
---

`Observable` is no longer exported from `@apollo/client` and will need to be imported from `rxjs` directly.

```diff
- import { Observable } from "@apollo/client";
+ import { Observable } from "rxjs";
```
