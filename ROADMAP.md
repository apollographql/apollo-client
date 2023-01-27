# 🔮 Apollo Client Roadmap

**Last updated: Jan 2023**

For up to date release notes, refer to the project's [Change Log](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PR's.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## 3.8

Currently in active development and being shipped in a series alpha releases.  React 18 users will get a lot out of this release since it introduces support for Suspense and (for you server-side rendering enthusiasts) `renderToPipeableStream`.  There are also new features added to the core as well.  Here's a brief overview:

- Add a new hook `useSuspenseQuery` which will provide the core functionality for React 18 `Suspense` capabilities
- Ability to use `Suspense` with `@defer`
- Introduce another new hook `useBackgroundQuery` with `Suspense` support
- Ability to use `Suspense` with  `useFragment`
- Server-side rendering (SSR) upgrade: support `renderToPipeableStream` for streaming renders
- Add the (opt-in) ability to access fields with the `@client` directive in the link chain

As we release each new feature we'll be looking for feedback from the community on performance, usage and developer experience of adopting and implementing these new concepts in your applications.  Try it today: `npm i @apollo/client@alpha` and let us know what you think!  Once new feature development is complete we'll move this to beta and then GA once stable.

See the [3.8 Milestone](https://github.com/apollographql/apollo-client/milestone/30) for more details.

## Future 3.x releases

The 3.8 release is a major milestone for the project's React support.  Feedback from the community will have a big impact on where we go next, particularly as use cases for React Server Components and other React 18 features emerge.  In addition to new functionality, there is a significant backlog of questions and fixes that we want to categorize and thoughtfully address in upcoming releases.

## 4.0

- `Release 4.0` will be our next major release of the Client and is still in early planning.  See Github [4.0 Milestone](https://github.com/apollographql/apollo-client/milestone/31) for more details.
