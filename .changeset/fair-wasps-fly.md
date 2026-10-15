---
"@apollo/client": patch
---

Fix an issue where a list field selected more than once with different selection sets lost the fields that only one of the selections included while a `@defer` boundary elsewhere in the query was still pending when using the `GraphQL17Alpha9Handler`. The results of all selections of the list field are now merged.
