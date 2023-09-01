---
"@apollo/client": patch
---

Fix an issue where race conditions when rapidly switching between variables would sometimes result in the wrong `data` returned from the query. Specifically this occurs when a query is triggered with an initial set of variables (`VariablesA`), then triggers the same query with another set of variables (`VariablesB`) but switches back to the `VariablesA` before the response for `VariablesB` is returned. Previously this would result in the data for `VariablesB` to be displayed while `VariablesA` was active. The data is for `VariablesA` is now properly returned.
