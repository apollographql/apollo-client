---
"@apollo/client": minor
---

Fix an issue with `refetchQueries` where comparing `DocumentNode`s internally by references could lead to an unknown query, even though the `DocumentNode` was indeed an active query—with a different reference. They are now compared as strings.
