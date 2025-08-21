---
"@apollo/client": major
_tags:
  - removals
  - imports
---

Move most of the utilities in `@apollo/client/utilities` to `@apollo/client/utilities/internal`. Many of the utilities exported from the `@apollo/client/utilities` endpoint were not considered stable.

As a result of this change, utilities or types exported from `@apollo/client/utilities` are now documented and considered stable and will not undergo breaking changes.
