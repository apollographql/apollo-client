---
"@apollo/client": minor
---

Fix issue where sibling `@defer` fragments were pruned incorrectly when at least one of the `@defer` fragments weren't delivered.

As a result of this change, a `label` argument is now added to all outgoing `@defer` directives when using the `GraphQL17Alpha9Handler` in order to disambiguate the `@defer` fragments from each other.
