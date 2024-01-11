---
'@apollo/client': patch
---

Address bundling issue introduced in [#11412](https://github.com/apollographql/apollo-client/pull/11412) where the `react/cache` internals ended up duplicated in the bundle. This was due to the fact that we had a `react/hooks` entrypoint that imported these files along with the newly introduced `createQueryPreloader` function, which lived outside of the `react/hooks` folder.
