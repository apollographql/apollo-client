---
"@apollo/client": patch
---

Fix an issue with `refetchQueries` where comparing `DocumentNode`s internally by references could lead to an unknown query, even though the `DocumentNode` was indeed an active query—with a different reference.
