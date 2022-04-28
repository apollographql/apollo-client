# 🔮 Apollo Client Roadmap

**Last updated: April 2022**

For up to date release notes, refer to the project's [Change Log](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md).

> **Please note:** This is an approximation of **larger effort** work planned for the next 6 - 12 months. It does not cover all new functionality that will be added, and nothing here is set in stone. Also note that each of these releases, and several patch releases in-between, will include bug fixes (based on issue triaging) and community submitted PR's.

## ✋ Community feedback & prioritization

- Please report feature requests or bugs as a new [issue](https://github.com/apollographql/apollo-client/issues/new/choose).
- If you already see an issue that interests you please add a 👍 or a comment so we can measure community interest.

---
## 3.7

1. Web Cache and performance improvements through new hooks (useBackgroundQuery, useFragment)
   - [#8694](https://github.com/apollographql/apollo-client/issues/8694)
   - [#8263](https://github.com/apollographql/apollo-client/issues/8263)
2. RefetchQueries not working when using string array after mutation
   - [#5419](https://github.com/apollographql/apollo-client/issues/5419)
3. Adding React suspense + data fetching support
   - [#9627](https://github.com/apollographql/apollo-client/issues/9627)

## 3.8

- *TBD*

## 3.9

- *TBD*

## 4.0

- Full React layer rewrite ([#8245](https://github.com/apollographql/apollo-client/issues/8245))
-  Removal of React from the default `@apollo/client` entry point ([#8190](https://github.com/apollographql/apollo-client/issues/8190))
- Core APIs to facilitate client/cache persistence (making life simpler for tools like [`apollo3-cache-persist`](https://github.com/apollographql/apollo-cache-persist), for example) ([#8591](https://github.com/apollographql/apollo-client/issues/8591))
