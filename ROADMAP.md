# 🔮 Apollo Client Roadmap

**Last updated: 2024-07-08**

For up to date release notes, refer to the project's [Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PRs.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## [3.11.0](https://github.com/apollographql/apollo-client/milestone/40) - July 17th, 2024
_Release candidate - July 9th, 2024_

- Rewriting `useQuery` and `useSubscription` for better React Compiler support
- Add an `ignoreResults` option to the `useSubscription` API
- Support extensions in useSubscription
- Support errorPolicy in useSubscription hook and subscribeToMore function
- React 19 rc compatibility

## Upcoming features

- Data masking
- Introduce a suspenseful `useFragment` that will suspend when the data is not yet loaded
- Leaner client (under alternate entry point)
- Better types for `useQuery`/`useMutation`/`useSubscription`

## 4.0

- `Release 4.0` will be our next major release of the Client and is still in early planning.  See Github [4.0 Milestone](https://github.com/apollographql/apollo-client/milestone/31) for more details.
