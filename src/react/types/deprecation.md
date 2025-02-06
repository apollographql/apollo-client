# Deprecation of `useQuery` and `useLazyQuery` lifecycle hooks

With the release of Apollo Client 3.13, we will be deprecating the `useQuery`
and `useLazyQuery` lifecycle hooks `onCompleted` and `onError` and will be removing them in Apollo Client 4.0.

These lifecycle hooks have long been the cause of confusion, bugs and
frustration for many developers. With this step we are following other tools
like React Query in their removal.

We encourage you to read [this comprehensive blog post](https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose) by React Query's maintainer [Dominik Dorfmeister](https://github.com/tkdodo) which provides some great insight into the pitfalls of these callback APIs. Apollo Client shares many of the same concerns.

While Apollo Client shares similar concerns, there are some additional reasons behind this change.

## `onCompleted`

### Conflicting interpretations for `onCompleted` behavior

Apollo Client uses a normalized cache, which means that there are many different
reasons why the data displayed by a component might change:

* The query initiated by the current hook might return data
* The same query might be initiated by another hook and update existing data
* You call `fetchMore`, `refetch`, etc.
* Another query or mutation might be overlapping with the query of the current hook and
  update some of its data
* An optimistic update might update some or all of the data of the hook
* A manual cache update might change the data for the hook

For each of these events, you will find developers that see it as intuitive that
the `onCompleted` callback should execute - or that it definitely should not execute.

### Added ambiguisity around `@defer`

What makes matters worse is that with the introduction of `@defer` in the GraphQL
ecosystem, we have yet another source of "updates".
Should `onComplete` run once the initial chunk of data arrives? After all
deferred fragments arrived? After each fragment?
While one behavior might make sense to some, others might have vastly different conflicting opinions that are equally valid.

### Changes around the behaviour

Adding insult to injury, we actually changed the behaviour of `onCompleted` slightly
at one point - where previously the callback was always called whenever a result
came in, now it's only called if a *different* result came in.
This can be alleviated by setting `notifyOnNetworkStatusChange` to `true`, but
it unfortunately adds to the confusion surrounding the callback.

Given this history, we are not confident that we can provide an approach that is intuitive for everyone and doesn't add more confusion among our userbase.

### Bugs

The final straw that made us come to this decision was [this bug report](https://github.com/apollographql/apollo-client/issues/12316):
With the current implementation, in some circumstances, the `onCompleted` and
`onError` callbacks can be stale by one render - and there's no good way we can
prevent that from happening in a matter that won't introduce new bugs in case you're
using suspense in your App.
React's [`useEffectEvent`](https://react.dev/learn/separating-events-from-effects#declaring-an-effect-event)
hook would solve this problem for us, but that hook is still experimental and
even when it is available, it won't be backported to the old React versions
which means we cannot provide a working solution for our entire userbase.
With the current available primitives, fixing this might be possible in a very
hacky way. Given everything else, we want to move everybody off these callbacks
instead of pushing additional bundle size on all our users for a feature we
don't recommend to use in the first place.

### What to use instead

The blog article by Dominik Dorfmeister linked above gives a lot of answers to what
to do instead, so I really recommend giving that a read.

In short:

* for derived state, use `useMemo`
* if you want to reset state in child components, use `key`
* if you want to (re)set or modify local component state as a reaction to the hook
  result changing, you can actually call the `setState`
  function of `useState` during component render, so you can use this to compare
  new results with old results and modify state as a consequence.
  See [this example in the React docs](https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  Keep in mind that this is a very rare use case and you should usually go with `useMemo`.
* if you are interested when an in-flight query is finished, keep an eye on `networkStatus`
* to synchronize things outside of React with your received data, use `useEffect`.

## `onError`

### `onError` is too localized

The `onError` callback will only execute when a query executed by the current hook
returns an error.
While that seems fine, remember: if you have two components calling the `useQuery`
hook with the same query, but different `onError` callbacks, only one or the other
will execute - depending on the order the components were rendered in, and also
influenced by prior cache contents.

### Bugs

`onError` suffers from the same potential timing issue described for `onCompleted`.

### What to use instead

Your component is probably the wrong place to handle errors like this, and you
should probably do it in a more centralized place such as an `onError` link, or
if you are using the suspenseful hooks, in an `ErrorBoundary` that is parent to
all components potentially calling your query.

## `useMutation` is not affected by this deprecation

`useMutation` doesn't suffer from most of the problems laid out here.
At this point we can't fully guaranteed that we won't also deprecate those
callbacks as they have some problems on their own, but this current deprecation
is simply not about them, so please let's keep discussion to `useQuery` and
`useLazyQuery` here.
