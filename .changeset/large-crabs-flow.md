---
"@apollo/client": major
---

Remove support for the `@export` directive. With the removal of local resolvers in Apollo Client core, there is no reliable way for `LocalResolversLink` to provide variable values needed by the cache when performing cache writes.
