# Apollo Client Versioning Policy

Apollo Client itself tries to follow SemVer versioning.

However, we reserve the right to change transpilation targets, drop polyfills or update required dependencies in minor releases.
This is to ensure that Apollo Client can take advantage of the latest JavaScript features, performance improvements, and security fixes.

This document tries to outline the versioning strategy for Apollo Client's dependencies.

## Syntax transpilation target

The current transpilation target for Apollo Client is `@babel/preset-env` with the `browserlist` target `since 2023, node >= 20, not dead`.

That means Apollo Client supports the following environments and their derivatives:

| Environment      | Version |
| ---------------- | ------- |
| Chrome           | 97+     |
| Firefox          | 96+     |
| Edge             | 97+     |
| Safari           | 15.4+   |
| Opera            | 83+     |
| Samsung Internet | 17+     |
| Node.js          | 20+     |

Using Apollo Client in different environments may require transpiling the syntax to a lower version, or polyfilling missing APIs.

This transpilation target might be updated in minor releases, but we commit to always include at least two years of browser support and the officially supported Node.js versions in the target.

## Language features

Between minor releases, Apollo Client might start using new APIs and language features that are considered ["Baseline: Widely available"](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility) by MDN.

## Non-polyfillable, non-transpilable language features

We try to avoid new features that cannot be transpiled or polyfilled.

However, we consider the following features to be supported widely enough that even though we do presently not use all of them, we might start using them in a minor and will not consider it a major breaking change.

- [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) (already used in Apollo Client)
- [`WeakSet`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet) (already used in Apollo Client)
- [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef) (already used by dependencies)
- [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry) (already used by dependencies)
- [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

## Dependencies

### TypeScript

We make an effort to only use TypeScript features that have been available as stable for at least one year. This usually means that if you stay within the [last four minor versions](https://github.com/microsoft/TypeScript/wiki/TypeScript%27s-Release-Process#how-often-does-typescript-release) of TypeScript, you will not run into issues with Apollo Client.

> Note that this is a shorter support window than [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped#support-window).

However, we do reserve the right to use newer syntax in new features, in a way that doesn't break compilation with older TypeScript versions. These new features might not be available to consumers on older TypeScript versions.

### React

We aim to support at least the latest two major versions of React.
Some Apollo Client features might require the latest major version of React and might not be available to consumers on older React versions.

> Please note that the React team almost never backports bugfixes to older major versions. You might encounter bugs in Apollo Client that are fixed in the latest React version, but not in older versions. We strongly recommend to always stay on the latest React version.

### React Native

We try to support at least the latest version of React Native. Note that React Native relies a lot of polyfills that might slightly differ from the implementations of other platforms, of completely miss some APIs.

Where possible, we try to avoid using APIs that are not available in React Native.
If this is not available, we will try to provide workarounds behind [the `react-native` exports condition](https://reactnative.dev/blog/2023/06/21/package-exports-support#the-new-react-native-condition).

### The `graphql` package

We commit to supporting the latest major version of the `graphql` package, with a grace period of at least one year before we drop support for older versions.

Within a `graphql` major, we can only guarantee compatibility with the latest minor versions, and strongly encourage consumers to regularly update the `graphql` package to get the latest bugfixes and features.

### other dependencies

We reserve the right to update dependencies in minor releases of Apollo Client, as well as dropping support for older versions of dependencies.
