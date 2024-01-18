# 🔮 Apollo Client Roadmap

**Last updated: 2024-01-16**

For up to date release notes, refer to the project's [Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PRs.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## [3.9.0](https://github.com/apollographql/apollo-client/milestone/32)

_Currently in beta phase_

  Tentative rc date: Jan 17, 2024

Features include:

- Ability to preload a query via a `createQueryPreloader`/`preloadQuery` function outside of a React component that can be used with `useReadQuery` to suspend while loading
- Introduce a new `useLoadableQuery` hook
- Introduce a new `useQueryRefHandlers` hook
- `<MockedProvider />` improvements
- Optimizing memory usage

## Future 3.x releases

## [3.10.0](https://github.com/apollographql/apollo-client/milestone/33)

_Currently in planning phase_

Features include:

- schema-driven testing utilities
- Introduce a suspenseful `useFragment` that will suspend when the data is not yet loaded
- Data masking
- leaner client (under alternate entry point)
- Better types for `useQuery`/`useMutation`/`useSubscription`
- Core `watchFragment` API to provide `useFragment`-like functionality for non-React envs

## 4.0

- `Release 4.0` will be our next major release of the Client and is still in early planning.  See Github [4.0 Milestone](https://github.com/apollographql/apollo-client/milestone/31) for more details.
