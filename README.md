# @rmosolgo/apollo-client

This is a fork of [apollographql/apollo-client](https://github.com/apollographql/apollo-client) with `@defer` support added to `master`.

I'll stop maintaining this fork when the upstream branch supports defer, you can keep an eye on:

- Apollo's initial [`@defer` support](https://github.com/apollographql/apollo-client/pull/3686)
- My initial [bug report](https://github.com/apollographql/apollo-client/issues/4484) and [patch](https://github.com/apollographql/apollo-client/pull/4504) for `@defer`-related issues
- My PR to [support `@defer` in master](https://github.com/apollographql/apollo-client/pull/4518)

## Installing

```
yarn add @rmosolgo/apollo-boost
# or
npm install @rmosolgo/apollo-boost
```

The same installation command works for other packages in this repository:

- `@rmosolgo/apollo-cache`
- `@rmosolgo/apollo-cache-inmemory`
- `@rmosolgo/apollo-cache-client`
- `@rmosolgo/apollo-cache-utilities`
- `@rmosolgo/graphql-anywhere`


After installing the packages, update your `import`s (or `require`s) to use the new scope:

```diff
- import ApolloClient from "apollo-boost";
+ import ApolloClient from "@rmosolgo/apollo-boost";
```
