---
"@apollo/client": major
---

Apollo Client now defaults to production mode, not development mode, if the
environment cannot be determined.

In modern bundlers, this should automatically be handled by the bundler loading
the bundler with the `development` export condition.

If neither the `production` nor the `development` export condition are
used by the bundler/runtime, Apollo Client will fall back to `globalThis.__DEV__`
to determine if it should run in production or development mode.

Unlike Apollo Client 3 though, if `globalThis.__DEV__` is not set to `true`,
Apollo Client will now default to `production`, not to `development`, behaviour.

This switch to *explicilty* requiring `true` also resolves a situation where
an HTML element with `id="__DEV__"` would create a global `__DEV__` variable
with a referent to the DOM element, which in the past was picked up as "truthy" and
would have triggered development mode.
