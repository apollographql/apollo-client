# 🔮 Apollo Client Roadmap

**Last updated: Dec 2022**

For up to date release notes, refer to the project's [Change Log](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PR's.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## 3.8
`Release 3.8` will be a series of Alpha releases introducing React 18 & SSR `experimental` features so they can be tested and adopted incrementally.  Eventually these features will be moving to Beta and then to RC and GA release status.

- Adding a new hook `useSuspenseQuery` which will provide the core functionality for React 18 `Suspense` capabilities.
- Adding support for `Suspense` to `@defer`.
- Introducing another new hook `useBackgroundQuery` with `Suspense` support.
- Updating `useFragment` with `Suspense` support.
- Offer support for React 18's `SSR` `renderToPipeableStream`

As we release each new feature we'll be looking for feedback from the community on performance, usage and developer experience of adopting and implementing these new concepts in your applications.

See Github [3.8 Milestone](https://github.com/apollographql/apollo-client/milestone/30) for more details.

## 3.9

- TBD

## 3.10

- TBD

## 4.0

- `Release 4.0` will be our next major release of the Client and is still in `pre-planning` phases. See Github [4.0 Milestone](https://github.com/apollographql/apollo-client/milestone/31) for more details.
