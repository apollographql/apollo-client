# 🔮 Apollo Client Ecosystem Roadmap

**Last updated: 2024-11-04**

For up to date release notes, refer to the project's [Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PRs.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## In progress

### Apollo Client

#### [3.12.0](https://github.com/apollographql/apollo-client/milestone/42) - November 18, 2024
_Release candidate - November 11, 2024_

- Data masking

#### Upcoming features

- Leaner client (under alternate entry point)
- Better types for `useQuery`/`useMutation`/`useSubscription`
- Introduce `useSuspenseFragment` that will suspend when the data is not yet loaded (experimental)

#### 4.0

- `Release 4.0` will be our next major release of the Client and is still in early planning.  See Github [4.0 Milestone](https://github.com/apollographql/apollo-client/milestone/31) for more details.

### GraphQL Testing Library

- New documentation
- Subscription support (waiting for MSW WebSocket support to land)

### VSCode Extension

- Bug fixes and long-requested features
- Apollo Client Devtools integration

### GraphQL Tag

- Started 3.0 milestone planning

### Apollo Client DevTools

- Ongoing work with fixing error messages shown in devtools
- Add a memory panel to monitor Apollo Client devtools internal caches
- Connectors debugger

### Apollo Client NextJS

- New/more robust documentation
- Support for `@defer` in RSC
