---
'@apollo/client': patch
---

The "per-React-Version-Singleton" ApolloContext is now stored on `globalThis`, not `React.createContext`, and throws an error message when accessed from React Server Components.
