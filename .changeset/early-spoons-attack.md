---
"@apollo/client": patch
---

Remove check for `window.__APOLLO_CLIENT__` when determining whether to connect to Apollo Client Devtools when `connectToDevtools` or `devtools.enabled` is not specified. This now simply checks to see if the application is in development mode.
