---
"@apollo/client": major
---

All links are now available as classes. The old creator functions have been deprecated.

Please migrate these function calls to class creations:

```diff
import {
- setContext
+ SetContextLink
} from "@apollo/client/link/context"

-const link = setContext(...)
+const link = new SetContextLink(...)
```

```diff
import {
- createHttpLink
+ HttpLink
} from "@apollo/client/link/http"

-const link = createHttpLink(...)
+const link = new HttpLink(...)
```

```diff
import {
- createPersistedQueryLink
+ PersistedQueryLink
} from "@apollo/client/link/persisted-queries"

-const link = createPersistedQueryLink(...)
+const link = new PersistedQueryLink(...)
```

```diff
import {
- removeTypenameFromVariables
+ RemoveTypenameFromVariablesLink
} from "@apollo/client/link/remove-typename"

-const link = removeTypenameFromVariables(...)
+const link = new RemoveTypenameFromVariablesLink(...)
```

