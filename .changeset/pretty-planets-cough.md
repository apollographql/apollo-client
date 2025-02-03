---
"@apollo/client": patch
---

Provide more accurate type safe previousQueryResult in updateQuery's callback by checking if the query result is complete.
Fixed typescript type of `variables` in query.subscribeToMore's callback's options.
Added `subscriptionVariables` to the options to access the subscription's variables.
