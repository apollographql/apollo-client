# Apollo Client Roadmap

*Last updated: August 2021*

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PR's.

## 3.5

**Estimated release:** Q3 2021

* New hooks: `useFragment` ([#8236](https://github.com/apollographql/apollo-client/issues/8236)) and `useBackgroundQuery`
* Non-breaking React layer refactoring, and compatibility with React 18 ([#8419](https://github.com/apollographql/apollo-client/issues/8419))

## 4.0

**Estimated release:** Q4 2021 / Q1 2022

* `@defer` support ([#8184](https://github.com/apollographql/apollo-client/issues/8184))
* Full React layer rewrite ([#8245](https://github.com/apollographql/apollo-client/issues/8245)), including the removal of React from the default `@apollo/client` entry point ([#8190](https://github.com/apollographql/apollo-client/issues/8190))
* Core APIs to facilitate client/cache persistence (making life simpler for tools like [`apollo3-cache-persist`](https://github.com/apollographql/apollo-cache-persist), for example) ([#8591](https://github.com/apollographql/apollo-client/issues/8591))
