---
"@apollo/client": patch
_tags:
  - ObservableQuery
  - polling
---

Ensure `ObservableQuery` stops polling if switching to a `standby` `fetchPolicy`. When switching back to a non-`standby` `fetchPolicy`, polling will resume.
