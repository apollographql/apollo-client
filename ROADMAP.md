# Apollo Client Roadmap

*Last updated: December 2020*

> Please note: This is an approximation of larger effort work planned for the next 6 months. It does not cover all new functionality that will be added, and nothing here is set in stone.

## 3.4

**Estimated release:** Q1 2021

* Out of the box cache persistence, providing a way for web/mobile users to save their application state for a defined period of time (along the lines of [`apollo3-cache-persist`](https://github.com/apollographql/apollo-cache-persist)).

* A new API for reobserving/refetching queries after a mutation, eliminating the need for `updateQueries`, `refetchQueries`, and `awaitRefetchQueries` in a lot of cases.

* Guarantee `===` equality for cache objects that are deeply equal, regardless of how they were computed / where they appear in result trees for different queries ([ref](https://github.com/apollographql/apollo-client/issues/4141#issuecomment-733091694)).

## 3.5

**Estimated release:** Q1/Q2 2021

* `@defer` support.
* `@stream` support.
* Refetching individual entity objects using an optional API like `Query._entities`.
* An improved story for async `read` functions, involving setting reactive vars from promises (enabling batching of multi-var updates).
* Allowing `useQuery` to survive across unmount/remount (by storing `QueryData` outside of a React ref), if the developer provides additional identifying information.

