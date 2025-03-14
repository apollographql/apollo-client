---
"@apollo/client": minor
---

Remove polyfills for Object.freeze,seal and preventExtensions in React Native

Instead of globally installing polyfills, we now use a very targeted ponyfill that
only applies when calling `Object.freeze` from `maybeDeepFreeze`.
