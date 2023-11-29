# 🔮 Apollo Client Roadmap

**Last updated: 2023-11-21**

For up to date release notes, refer to the project's [Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PRs.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## [3.9.0](https://github.com/apollographql/apollo-client/milestone/32)

_Currently in development phase_

Tentative beta date: Dec 1, 2023

Features we plan to tackle:

- Ability to preload a query outside of a React component that can be used with `useReadQuery` to suspend while loading
- Introduce a new `useLoadableQuery` hook
- `<MockedProvider />` improvements
- Optimizing memory usage in SSR scenarios

> NOTE: These are subject to change and are not guaranteed to be part of 3.9 at the time of this writing.

## Future 3.x releases

## [3.10.0](https://github.com/apollographql/apollo-client/milestone/33)

_Currently in planning phase_

- schema-driven testing utilities
- Introduce a suspenseful `useFragment` that will suspend when the data is not yet loaded

_Approximate Date: TBD_

The 3.8 release was a major milestone for the project's React support.  Feedback from the community will have a big impact on where we go next, particularly as use cases for React Server Components and other React 18 features emerge.  In addition to new functionality, there is a significant backlog of questions and fixes that we want to categorize and thoughtfully address in upcoming releases.

## 4.0

- `Release 4.0` will be our next major release of the Client and is still in early planning.  See Github [4.0 Milestone](https://github.com/apollographql/apollo-client/milestone/31) for more details.
