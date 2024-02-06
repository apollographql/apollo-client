---
"@apollo/client": patch
---

Fix issue in `useLazyQuery` that results in a double network call when calling the execute function with no arguments after having called it previously with another set of arguments.

####  Implementation impact

> This change only affects you if you use the query function returned from `useLazyQuery` in  a `useEffect` callback. If you do, `useEffect` may now fire more often when there are changes to the options passed to `useLazyQuery`.

The query function returned from `useLazyQuery` is no longer an unconditionally stable reference across renders. The function identity changes when options passed to `useLazyQuery` change, excluding callback function options. This change prevents stale closure issues in the query function which may result in subtle bugs.
