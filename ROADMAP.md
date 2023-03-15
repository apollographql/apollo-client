# 🔮 Apollo Client Roadmap

**Last updated: 2023-03-07**

For up to date release notes, refer to the project's [Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PRs.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---

## [3.8.0](https://github.com/apollographql/apollo-client/milestone/30)

_Approximate Date: 2023-04-14_

Currently in active development and being shipped in a series alpha releases.  React 18 users will get a lot out of this release since it introduces support for Suspense and (for you server-side rendering enthusiasts) `renderToPipeableStream`.  There are also new features added to the core as well.  Here's a brief overview:

- Add a new hook `useSuspenseQuery` which will provide the core functionality for React 18 `Suspense` capabilities
- Ability to use `Suspense` with `@defer`
- Introduce another new hook `useBackgroundQuery` with `Suspense` support
- Ability to use `Suspense` with  `useFragment`
- Server-side rendering (SSR) upgrade: support `renderToPipeableStream` for streaming renders
- Support custom GraphQL document transforms

As we release each new feature we'll be looking for feedback from the community on performance, usage and developer experience of adopting and implementing these new concepts in your applications.  Try it today: `npm i @apollo/client@alpha` and let us know what you think!  Once new feature development is complete we'll move this to beta and then GA once stable.

## Future 3.x releases

_Approximate Date: TBD_

The 3.8 release is a major milestone for the project's React support.  Feedback from the community will have a big impact on where we go next, particularly as use cases for React Server Components and other React 18 features emerge.  In addition to new functionality, there is a significant backlog of questions and fixes that we want to categorize and thoughtfully address in upcoming releases.

## Demo app: Spotify clone

_Approximate Date: 2023-03-08_

We are working on a full-stack Spotify clone to showcase and test the capabilities of Apollo Client 3.8.  Right now it's a private repository that we're using to dogfood the alpha branch internally.  We will open-source it in the near future for use as a demonstration of how to use features like `useSuspenseQuery` and `useBackgroundQuery` in a nontrivial React app.  It may also be useful as a bug reproduction template in the future.

## 4.0

- `Release 4.0` will be our next major release of the Client and is still in early planning.  See Github [4.0 Milestone](https://github.com/apollographql/apollo-client/milestone/31) for more details.
