---
"@apollo/client": patch
---

Ensure `ObservableQuery` stops polling if switching to a `standby` `fetchPolicy`. When switching back to a non-`standby` `fetchPolicy`, polling will resume.
