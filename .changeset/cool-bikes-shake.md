---
"@apollo/client": minor
---

Remove polyfills for Object.freeze,seal and preventExtensions in React Native

These polyfills were only necessary until React Native 0.59, which
[patched the problem](https://github.com/facebook/react-native/pull/21492) on
the React Native side.

With React Native 0.61, the `Map` function was [completely replaced](https://github.com/facebook/react-native/commit/93b9ac74e59bbe84ea388d7c1879857b4acab114)
with a native implementation that never had the problems we guarded against.
