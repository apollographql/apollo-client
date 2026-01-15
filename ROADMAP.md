# 🔮 Apollo Client Ecosystem Roadmap

**Last updated: 2026-01-07**

For up to date release notes, refer to the project's [Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PRs.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## In progress

### Apollo Client

#### 4.1.0

_Release candidate - January 7th, 2026_

- Support for `@stream`
- Add support for the `graphql@17.0.0-alpha.9` incremental delivery format
- Improvements for existing incremental delivery implementation
  - Improvements to array merging behavior
  - Improvements to `readFragment`/`writeFragment` (add `from` option)
- Add support for `useFragment`/`useSuspenseFragment` with arrays

### GraphQL Testing Library

_No planned work_

### VSCode Extension

_No planned work_

### GraphQL Tag

_No planned work_

### Apollo Client DevTools

- Support for inspecting Apollo Client instances in iframes

### Apollo Client React Framework Integrations

- Client integration documentation

**TanStack Start**

- Support for Apollo Client Streaming in TanStack Start - will stay release candidate

**React Router**

- Support for Apollo Client Streaming in React Router 7 - will stay alpha
