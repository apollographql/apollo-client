---
"@apollo/client": patch
---

Added option to skip updateQuery when cache has partial or no data.
Will become default behavior in v4.

Fixed typescript type of `variables` in query.subscribeToMore's callback's options.
Added `subscriptionVariables` to the options to access the subscription's variables.
