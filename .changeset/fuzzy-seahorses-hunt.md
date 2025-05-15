---
"@apollo/client": patch
---

Remove code that strips `@client` fields in `HttpLink` and `BatchHttpLink`. This was unused code since core handles removing `@client` fields and should have no observable change.
