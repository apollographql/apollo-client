---
'@apollo/client': minor
---

Add a new mechanism for Error Extraction to reduce bundle size.
Errors will display a link to an error page with the entire error message.
This replaces both "development" and "production" errors and works without
additional bundler configuration.