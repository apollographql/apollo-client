Adds a new `skipPollAttempt` callback function that's called whenever a refetch attempt occurs while polling. If the function returns `true`, the refetch is skipped and not reattempted until the next poll interval. This will solve the frequent use-case of disabling polling when the window is inactive.
```ts
useQuery(QUERY, {
  pollInterval: 1000,
  skipPollAttempt: () => document.hidden // or !document.hasFocus()
});
// or define it globally
new ApolloClient({
  defaultOptions: {
    watchQuery: {
      skipPollAttempt: () => document.hidden // or !document.hasFocus()
    }
  }
})
