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

Apollo Client users have provided logical justification for each of these cases for why the `onCompleted` callback should or should not execute.

### Added ambiguity around `@defer`

With the introduction of the `@defer` directive in the GraphQL
ecosystem, we have yet another source of "updates" which provides further
complication.
Should `onCompleted` run once the initial chunk of data arrives? After all
deferred fragments arrived? After each fragment?
While one behavior might make sense to some, others might have vastly different conflicting opinions that are equally valid.

### Changes around the behaviour

Adding insult to injury, `onCompleted` had a bug in versions from versions 3.5 to 3.7
where cache changes in addition to network requests would execute the `onCompleted`
callback. This was fixed in version [3.8](https://github.com/apollographql/apollo-client/releases/tag/v3.8.0) with #10229, but the damage was done.
While the users who initially reported the bug were satisfied, others came to
expect the behavior from 3.5 to 3.7 as the correct behavior.

Given this history, we are not confident that we can provide an approach that is intuitive for everyone and doesn't add more confusion among our userbase.

### Our recommendation

As we've received questions about `onCompleted` through various issues and our
community forum, the solutions we propose often involve moving away from
`onCompleted` entirely. Many of the cases where we see `onCompleted` used
involve some kind of state syncing which is a highly discouraged pattern (see
the section on ["State
Syncing"](https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose#state-syncing)
in Dominik's blog post for an example.) We have recommended against using the
the use of these callbacks for quite some time now for one reason or another and
believe its time for us to sunset these APIs.

### Bugs

The final straw that made us come to this decision was [this bug report](https://github.com/apollographql/apollo-client/issues/12316):
With the current implementation, in some circumstances, the `onCompleted` and
`onError` callbacks can be stale by one render. Unfortunately there is no perfect
solution that can prevent that from happening in a manner that won't introduce new bugs,
for example when using suspense in your App.

React's [`useEffectEvent`](https://react.dev/learn/separating-events-from-effects#declaring-an-effect-event)
hook might solve this problem for us, but that hook is still experimental.
Even when it is available, it won't be backported to the old React versions
which means we cannot provide a working solution for our entire userbase.

This isn't the first issue that's been opened in regards to timing issues with
`onCompleted`. Once again, this is one of those cases where varying logical
opinions make it impossible to determine the correct behavior. React itself does
not guarantee stability on the timing of renders between major versions which
further complicates this issue as upgrading React versions might subtly change
the timing of when `onCompleted` executes.

With the current available primitives, fixing this might be possible in a very
hacky way, but given everything else and the fact that we discourage its use, we
want to move everybody off these callbacks instead of pushing additional bundle
size on all our users.

### What to use instead

Once again, we recommend reading the [blog article](https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose)
by Dominik Dorfmeister which provides a lot of answers on what to use in place
of these callbacks.

In short:

* For derived state, use `useMemo`
* If you want to reset state in child components, use `key`
* If you want to (re)set or modify local component state as a reaction to the hook
  result changing, you can actually call the `setState`
  function of `useState` during component render, so you can use this to compare
  new results with old results and modify state as a consequence.
  See [this example in the React docs](https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  Keep in mind that this is a very rare use case and you should usually go with `useMemo`.
* If you are interested when an in-flight query is finished, keep an eye on `networkStatus`
* To synchronize things outside of React with your received data, use `useEffect`.

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
