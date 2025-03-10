---
"@apollo/client": minor
---

Apollo Client is no longer using `ts-invariant`, but ships with a modified variant of it.

The existing export `setLogVerbosity` from `@apollo/client` is still available and
now points to this new integration.
**In most cases, you should be using this export.**
It will no longer adjust the verbosity of `ts-invariant` and as such no longer
influence other packages relying on `ts-invariant`.

The new entry point `@apollo/client/utilities/invariant` now exports `invariant`,
`InvariantError` and `setVerbosity`.
(Note that these tools are mostly meant to be used by Apollo Client and libraries directly
based on Apollo Client like the `@apollo/client-integration-*` packages.)
