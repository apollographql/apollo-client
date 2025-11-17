# 🔮 Apollo Client Ecosystem Roadmap

**Last updated: 2025-11-12**

For up to date release notes, refer to the project's [Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PRs.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## In progress

### Apollo Client

#### 4.1.0

_Release candidate - November 21st, 2025_

- Support for `@stream`
- Add support for the `graphql@17.0.0-alpha.9` incremental delivery format
- Improvements for existing incremental delivery implementation
  - Improvements to array merging behavior
  - Improvements to `readFragment`/`writeFragment` (add `from` option)
- Add support for `useFragment`/`useSuspenseFragment` with arrays

### GraphQL Testing Library

- New documentation
- Subscription support

_These changes will take longer than anticipated due to prioritization of other libraries and integrations_

### VSCode Extension

_No outstanding work_

### GraphQL Tag

- `Release 3.0` will be our next major release of `graphql-tag` and is still in planning. See Github [3.0 Milestone](https://github.com/apollographql/graphql-tag/milestone/3) for more details.

### Apollo Client DevTools

- Support cache write history

### Apollo Client React Framework Integrations

- New/more robust documentation

**TanStack Start**

- Support for Apollo Client Streaming in TanStack Router - will stay alpha

**React Router**

- Support for Apollo Client Streaming in React Router 7 - will stay alpha
