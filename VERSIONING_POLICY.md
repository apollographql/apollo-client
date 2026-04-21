# Apollo Client Versioning Policy

Apollo Client tries to follow SemVer versioning.

However, we reserve the right to change transpilation targets, drop polyfills or update required dependencies. These changes will be released in minor versions.
This is to ensure that Apollo Client can take advantage of the latest JavaScript features, performance improvements, and security fixes.

This document outlines the versioning strategy for Apollo Client's dependencies.

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

Using Apollo Client in different environments may require you to transpile the syntax using a lower version, or polyfilling missing APIs.

We reserve the right to update the transpilation target in minor releases, but we commit to always include at least two years of browser support and the officially supported Node.js versions in the target.

## Language features

Apollo Client might start using new APIs and language features that are considered ["Baseline: Widely available"](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility) by MDN. Usage of new language features will be released in a new minor version.

### Non-polyfillable, non-transpilable language features

We try to avoid new features that cannot be transpiled or polyfilled.

However, we consider the following features to be supported widely enough that Apollo Client can use them at any time without considering it a major breaking change.

- [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) (already used in Apollo Client)
- [`WeakSet`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet) (already used in Apollo Client)
- [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef) (already used by dependencies)
- [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry) (already used by dependencies)
- [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

> [!NOTE]
> Not all of the these features are currently used at this time. Usage of these features might fluctuate between minor versions.

## TypeScript types

We reserve the right to update TypeScript types as needed, such as to fix bugs, align types with actual runtime behavior or add compatibility with changes in upcoming TypeScript versions.
Updates to types might requires changes to your application, and while we are careful to keep such changes to a minimum, we do not consider these breaking changes in the sense of SemVer.

## Dependencies

### TypeScript

We make an effort to only use TypeScript features that have been available as stable for at least one year. This generally means we support the [last four minor versions](https://github.com/microsoft/TypeScript/wiki/TypeScript%27s-Release-Process#how-often-does-typescript-release) of TypeScript. If you use a TypeScript version older than these, you might experience some type compatibility issues with Apollo Client.

> Note that this is a shorter support window than [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped#support-window).

However, we reserve the right to use newer syntax in new features, in a way that doesn't break compilation with older TypeScript versions. These new features might not be available to consumers on older TypeScript versions.

### React

We aim to support, at minimum, the latest two major versions of React.
Some Apollo Client features might require the latest major version of React and won't be available to consumers on older React versions (e.g. `useSuspenseQuery` which relies on React Suspense).

We will note when such a case occurs so that you understand when a feature requires a specific React version.

> Please note that the React team almost never backports bugfixes to older major versions. From time to time, you might encounter bugs when using Apollo Client caused by React itself that are fixed in recent React versions, but are unavailable in older major versions. We strongly recommend you keep up-to-date with the latest React version.

### React Native

We try to support, at minimum, the latest version of React Native. Note that React Native relies on many polyfills that might differ from the implementations of other platforms. Some polyfills might also be missing.

Where possible, we try to avoid using APIs that are not available in React Native.
If an API is not available, we will try to provide workarounds using the [`react-native` exports condition](https://reactnative.dev/blog/2023/06/21/package-exports-support#the-new-react-native-condition).

### The `graphql` package

We commit to supporting the latest major version of the `graphql` package, with a grace period of at least one year before we drop support for older versions.

Within a `graphql` major, we only guarantee compatibility with the latest minor version. We strongly encourage consumers to regularly update the `graphql` package to get the latest bugfixes and features.

### Other dependencies

We reserve the right to update dependencies in minor releases of Apollo Client, as well as dropping support for older versions of dependencies.

### Peer dependencies

The rules stated above apply to peer dependencies as well. Peer dependencies can be updated in minor releases, just like regular dependencies.
However, we do commit to not adding new peer dependencies during the lifetime of a major - but if an existing peer dependency is renamed, we might follow that rename in a minor release.
