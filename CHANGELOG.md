# @apollo/client

## 3.8.8

### Patch Changes

- [#11200](https://github.com/apollographql/apollo-client/pull/11200) [`ae5091a21`](https://github.com/apollographql/apollo-client/commit/ae5091a21f0feff1486503071ea8dc002cf1be41) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Enable `strict` in tsconfig for the entire project.

- [#11332](https://github.com/apollographql/apollo-client/pull/11332) [`291aea56b`](https://github.com/apollographql/apollo-client/commit/291aea56bfaed3987a98be7fe4e6160114b62d2d) Thanks [@asvishnyakov](https://github.com/asvishnyakov)! - Add missed reexports of MutationFetchPolicy and RefetchWritePolicy to @apollo/client/core

- [#10931](https://github.com/apollographql/apollo-client/pull/10931) [`e5acf910e`](https://github.com/apollographql/apollo-client/commit/e5acf910e39752b453540b6751046d1c19b66350) Thanks [@phryneas](https://github.com/phryneas)! - `useMutation`: also reset internal state on reset

## 3.8.7

### Patch Changes

- [#11297](https://github.com/apollographql/apollo-client/pull/11297) [`c8c76a522`](https://github.com/apollographql/apollo-client/commit/c8c76a522e593de0d06cff73fde2d9e88152bed6) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add an explicit return type for the `useReadQuery` hook called `UseReadQueryResult`. Previously the return type of this hook was inferred from the return value.

- [#11337](https://github.com/apollographql/apollo-client/pull/11337) [`bb1da8349`](https://github.com/apollographql/apollo-client/commit/bb1da8349e785c54fb4030f269602c900adf23a0) Thanks [@phryneas](https://github.com/phryneas)! - #11206 used the TypeScript syntax `infer X extends Y` that was introduced in TS 4.8.
  This caused some problems for some users, so we are rolling back to a more backwars-compatible (albeit slightly less performant) type.

## 3.8.6

### Patch Changes

- [#11291](https://github.com/apollographql/apollo-client/pull/11291) [`2be7eafe3`](https://github.com/apollographql/apollo-client/commit/2be7eafe3c115d56d993dbda64d320550712df1f) Thanks [@ArioA](https://github.com/ArioA)! - Fix a bug that allows to only call `loadErrorMessages` without also calling `loadDevErrorMessages`.

- [#11274](https://github.com/apollographql/apollo-client/pull/11274) [`b29f000f3`](https://github.com/apollographql/apollo-client/commit/b29f000f36f281e256809b5454eaeca2ec4450bf) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Start the query ref auto dispose timeout after the initial promise has settled. This prevents requests that run longer than the timeout duration from keeping the component suspended indefinitely.

- [#11289](https://github.com/apollographql/apollo-client/pull/11289) [`b5894dbf0`](https://github.com/apollographql/apollo-client/commit/b5894dbf0fd5ea5ef1ff20dd896a658ef78c69dc) Thanks [@phryneas](https://github.com/phryneas)! - `MockedProvider`: default `connectToDevTools` to `false` in created `ApolloClient` instance.

  This will prevent the mocked `ApolloClient` instance from trying to connect to the DevTools, which would start a `setTimeout` that might keep running after a test has finished.

- [#11206](https://github.com/apollographql/apollo-client/pull/11206) [`dd2ce7687`](https://github.com/apollographql/apollo-client/commit/dd2ce7687ae9afa399e950a523fc7330284c25fe) Thanks [@phryneas](https://github.com/phryneas)! - `cache.modify`: Less strict types & new dev runtime warnings.

## 3.8.5

### Patch Changes

- [#11266](https://github.com/apollographql/apollo-client/pull/11266) [`5192cf6e1`](https://github.com/apollographql/apollo-client/commit/5192cf6e1e958080bcae09e5967fa6851bd3a78c) Thanks [@phryneas](https://github.com/phryneas)! - Fixes argument handling for invariant log messages.

- [#11235](https://github.com/apollographql/apollo-client/pull/11235) [`6cddaaf65`](https://github.com/apollographql/apollo-client/commit/6cddaaf6543f5c0b1fb04ba47480fb393ba10de7) Thanks [@phryneas](https://github.com/phryneas)! - Fix nextFetchPolicy behaviour with transformed documents by keeping `options` reference stable when passing it through QueryManager.

- [#11252](https://github.com/apollographql/apollo-client/pull/11252) [`327a2abbd`](https://github.com/apollographql/apollo-client/commit/327a2abbd5db87ca27f2ffd1d2f8dccd75868a58) Thanks [@phryneas](https://github.com/phryneas)! - Fixes a race condition in asyncMap that caused issues in React Native when errors were returned in the response payload along with a data property that was null.

- [#11229](https://github.com/apollographql/apollo-client/pull/11229) [`c372bad4e`](https://github.com/apollographql/apollo-client/commit/c372bad4ebd01a4f2e772cd76e873143bf043fe6) Thanks [@phryneas](https://github.com/phryneas)! - Remove (already throwing) SuspenseCache export that should have been removed in 3.8.

- [#11267](https://github.com/apollographql/apollo-client/pull/11267) [`bc055e068`](https://github.com/apollographql/apollo-client/commit/bc055e0683e87b9445e321f73857f4a91b20a9ce) Thanks [@phryneas](https://github.com/phryneas)! - Remove some dead code.

## 3.8.4

### Patch Changes

- [#11195](https://github.com/apollographql/apollo-client/pull/11195) [`9e59b251d`](https://github.com/apollographql/apollo-client/commit/9e59b251d4d63afb83d9821889f87c71c4adde0f) Thanks [@phryneas](https://github.com/phryneas)! - For `invariant.log` etc., error arguments are now serialized correctly in the link to the error page.

## 3.8.3

### Patch Changes

- [#11193](https://github.com/apollographql/apollo-client/pull/11193) [`fd2a4cf0c`](https://github.com/apollographql/apollo-client/commit/fd2a4cf0c3ada968df3f9814d87dedaaa8eddb5e) Thanks [@phryneas](https://github.com/phryneas)! - Call devtools registration after ApolloClient is fully set up.

## 3.8.2

### Patch Changes

- [#10072](https://github.com/apollographql/apollo-client/pull/10072) [`51045c336`](https://github.com/apollographql/apollo-client/commit/51045c336ff86befbdd598af6e7104ffe0d419d0) Thanks [@Huulivoide](https://github.com/Huulivoide)! - Fixes race conditions in useReactiveVar that may prevent updates to the reactive variable from propagating through the hook.

- [#11162](https://github.com/apollographql/apollo-client/pull/11162) [`d9685f53c`](https://github.com/apollographql/apollo-client/commit/d9685f53c34483245e6ea21e91b669ef1180ae97) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Ensures GraphQL errors returned in subscription payloads adhere to the `errorPolicy` set in `client.subscribe(...)` calls.

- [#11134](https://github.com/apollographql/apollo-client/pull/11134) [`96492e142`](https://github.com/apollographql/apollo-client/commit/96492e14279d78e2613c1381d31f88cdf5816f45) Thanks [@alessbell](https://github.com/alessbell)! - Use separate type imports in useSuspenseQuery and useBackgroundQuery to workaround SWC compiler issue.

- [#11117](https://github.com/apollographql/apollo-client/pull/11117) [`6b8198109`](https://github.com/apollographql/apollo-client/commit/6b8198109bd9fe5eedf352421a0a773ac0acfb18) Thanks [@phryneas](https://github.com/phryneas)! - Adds a new devtools registration mechanism and tweaks the mechanism behind the
  "devtools not found" mechanic.

- [#11186](https://github.com/apollographql/apollo-client/pull/11186) [`f1d429f32`](https://github.com/apollographql/apollo-client/commit/f1d429f32ae8e896155b50f1fc7c51dfeb06c3ba) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fix an issue where race conditions when rapidly switching between variables would sometimes result in the wrong `data` returned from the query. Specifically this occurs when a query is triggered with an initial set of variables (`VariablesA`), then triggers the same query with another set of variables (`VariablesB`) but switches back to the `VariablesA` before the response for `VariablesB` is returned. Previously this would result in the data for `VariablesB` to be displayed while `VariablesA` was active. The data is for `VariablesA` is now properly returned.

- [#11163](https://github.com/apollographql/apollo-client/pull/11163) [`a8a9e11e9`](https://github.com/apollographql/apollo-client/commit/a8a9e11e917716538206eb7d5de21dbfd09630bd) Thanks [@bignimbus](https://github.com/bignimbus)! - Fix typo in error message: "occured" -> "occurred"

- [#11180](https://github.com/apollographql/apollo-client/pull/11180) [`7d9c481e5`](https://github.com/apollographql/apollo-client/commit/7d9c481e53f3c9577ec6ed6231c9e3db8c8b374b) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fixes an issue where refetching from `useBackgroundQuery` via `refetch` with an error after an error was already fetched would get stuck in a loading state.

## 3.8.1

### Patch Changes

- [#11141](https://github.com/apollographql/apollo-client/pull/11141) [`c469b1616`](https://github.com/apollographql/apollo-client/commit/c469b1616517aac124a3357066cd83439463033c) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Remove newly exported response iterator helpers that caused problems on some installs where `@types/node` was not available.

  **IMPORTANT**

  The following exports were added in version 3.8.0 that are removed with this patch.

  - `isAsyncIterableIterator`
  - `isBlob`
  - `isNodeReadableStream`
  - `isNodeResponse`
  - `isReadableStream`
  - `isStreamableBlob`

## 3.8.0

### Minor Changes

#### Fetching with Suspense 🎉

- [#10323](https://github.com/apollographql/apollo-client/pull/10323) [`64cb88a4b`](https://github.com/apollographql/apollo-client/commit/64cb88a4b6be8640c4e0d753dd06ddf4c25a2bc3) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add support for React suspense with a new `useSuspenseQuery` hook.

  `useSuspenseQuery` initiates a network request and causes the component calling it to suspend while the request is in flight. It can be thought of as a drop-in replacement for `useQuery` that allows you to take advantage of React's concurrent features while fetching during render.

  Consider a `Dog` component that fetches and renders some information about a dog named Mozzarella:

  <details>
    <summary>View code 🐶</summary>

  ```tsx
  import { Suspense } from "react";
  import { gql, TypedDocumentNode, useSuspenseQuery } from "@apollo/client";

  interface Data {
    dog: {
      id: string;
      name: string;
    };
  }

  interface Variables {
    name: string;
  }

  const GET_DOG_QUERY: TypedDocumentNode<Data, Variables> = gql`
    query GetDog($name: String) {
      dog(name: $name) {
        id
        name
      }
    }
  `;

  function App() {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <Dog name="Mozzarella" />
      </Suspense>
    );
  }

  function Dog({ name }: { name: string }) {
    const { data } = useSuspenseQuery(GET_DOG_QUERY, {
      variables: { name },
    });

    return <>Name: {data.dog.name}</>;
  }
  ```

  </details>

  For a detailed explanation of `useSuspenseQuery`, see our [fetching with Suspense reference](https://www.apollographql.com/docs/react/data/suspense).

- [#10755](https://github.com/apollographql/apollo-client/pull/10755) [`e3c676deb`](https://github.com/apollographql/apollo-client/commit/e3c676deb59d006f33d24a7211e58725a67641b8) Thanks [@alessbell](https://github.com/alessbell)! - Feature: adds `useBackgroundQuery` and `useReadQuery` hooks

  `useBackgroundQuery` initiates a request for data in a parent component and returns a `QueryReference` which is used to read the data in a child component via `useReadQuery`. If the child component attempts to render before the data can be found in the cache, the child component will suspend until the data is available. On cache updates to watched data, the child component calling `useReadQuery` will re-render with new data **but the parent component will not re-render** (as it would, for example, if it were using `useQuery` to issue the request).

  Consider an `App` component that fetches a list of breeds in the background while also fetching and rendering some information about an individual dog, Mozzarella:

  <details>
    <summary>View code 🐶</summary>

  ```tsx
  function App() {
    const [queryRef] = useBackgroundQuery(GET_BREEDS_QUERY);
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <Dog name="Mozzarella" queryRef={queryRef} />
      </Suspense>
    );
  }

  function Dog({
    name,
    queryRef,
  }: {
    name: string;
    queryRef: QueryReference<BreedData>;
  }) {
    const { data } = useSuspenseQuery(GET_DOG_QUERY, {
      variables: { name },
    });
    return (
      <>
        Name: {data.dog.name}
        <Suspense fallback={<div>Loading breeds...</div>}>
          <Breeds queryRef={queryRef} />
        </Suspense>
      </>
    );
  }

  function Breeds({ queryRef }: { queryRef: QueryReference<BreedData> }) {
    const { data } = useReadQuery(queryRef);
    return data.breeds.map(({ characteristics }) =>
      characteristics.map((characteristic) => (
        <div key={characteristic}>{characteristic}</div>
      ))
    );
  }
  ```

  </details>

  For a detailed explanation of `useBackgroundQuery` and `useReadQuery`, see our [fetching with Suspense reference](https://www.apollographql.com/docs/react/data/suspense).

#### Document transforms 📑

- [#10509](https://github.com/apollographql/apollo-client/pull/10509) [`79df2c7ba`](https://github.com/apollographql/apollo-client/commit/79df2c7ba55b7cfee69fd54024174f77099a2550) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add the ability to specify custom GraphQL document transforms. These transforms are run before reading data from the cache, before local state is resolved, and before the query document is sent through the link chain.

  To register a custom document transform, create a transform using the `DocumentTransform` class and pass it to the `documentTransform` option on `ApolloClient`.

  ```ts
  import { DocumentTransform } from "@apollo/client";

  const documentTransform = new DocumentTransform((document) => {
    // do something with `document`
    return transformedDocument;
  });

  const client = new ApolloClient({ documentTransform: documentTransform });
  ```

  For more information on the behavior and API of `DocumentTransform`, see its [reference page in our documentation](https://www.apollographql.com/docs/react/data/document-transforms).

#### New `removeTypenameFromVariables` link 🔗

- [#10853](https://github.com/apollographql/apollo-client/pull/10853) [`300957960`](https://github.com/apollographql/apollo-client/commit/300957960a584920f2d346d29a0b3aaeb27d9489) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Introduce the new `removeTypenameFromVariables` link. This link will automatically remove `__typename` fields from `variables` for all operations. This link can be configured to exclude JSON-scalars for scalars that utilize `__typename`.

  This change undoes some work from [#10724](https://github.com/apollographql/apollo-client/pull/10724) where `__typename` was automatically stripped for all operations with no configuration. This was determined to be a breaking change and therefore moved into this link.

  For a detailed explanation of `removeTypenameFromVariables`, see its [API reference](https://www.apollographql.com/docs/react/api/link/apollo-link-remove-typename).

#### New `skipToken` sentinel ⏭️

- [#11112](https://github.com/apollographql/apollo-client/pull/11112) [`b4aefcfe9`](https://github.com/apollographql/apollo-client/commit/b4aefcfe97213461b9ce01946344e6a5e6d80704) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Adds support for a `skipToken` sentinel that can be used as `options` in `useSuspenseQuery` and `useBackgroundQuery` to skip execution of a query. This works identically to the `skip` option but is more type-safe and as such, becomes the recommended way to skip query execution. As such, the `skip` option has been deprecated in favor of `skipToken`.

  We are considering the removal of the `skip` option from `useSuspenseQuery` and `useBackgroundQuery` in the next major. We are releasing with it now to make migration from `useQuery` easier and make `skipToken` more discoverable.

  **`useSuspenseQuery`**

  ```ts
  import { skipToken, useSuspenseQuery } from "@apollo/client";

  const id: number | undefined;

  const { data } = useSuspenseQuery(
    query,
    id ? { variables: { id } } : skipToken
  );
  ```

  **`useBackgroundQuery`**

  ```ts
  import { skipToken, useBackgroundQuery } from "@apollo/client";

  function Parent() {
    const [queryRef] = useBackgroundQuery(
      query,
      id ? { variables: { id } } : skipToken
    );

    return queryRef ? <Child queryRef={queryRef} /> : null;
  }

  function Child({ queryRef }: { queryRef: QueryReference<TData> }) {
    const { data } = useReadQuery(queryRef);
  }
  ```

  For a detailed explanation of `skipToken`, see its [API reference](https://www.apollographql.com/docs/react/api/react/hooks/#skiptoken).

#### New error extraction mechanism, smaller bundles 📉

- [#10887](https://github.com/apollographql/apollo-client/pull/10887) [`f8c0b965d`](https://github.com/apollographql/apollo-client/commit/f8c0b965d49fb7d802371bb9cc3cb0b60cf05e5d) Thanks [@phryneas](https://github.com/phryneas)! - Add a new mechanism for Error Extraction to reduce bundle size by including error message texts on an opt-in basis.

  By default, errors will link to an error page with the entire error message.
  This replaces "development" and "production" errors and works without
  additional bundler configuration.

  Bundling the text of error messages and development warnings can be enabled as follows:

  ```js
  import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";
  if (process.env.NODE_ENV !== "production") {
    loadErrorMessages();
    loadDevMessages();
  }
  ```

  For a detailed explanation, see our [reference on reducing bundle size](https://www.apollographql.com/docs/react/development-testing/reducing-bundle-size).

#### New `@nonreactive` directive 🎬

- [#10722](https://github.com/apollographql/apollo-client/pull/10722) [`c7e60f83d`](https://github.com/apollographql/apollo-client/commit/c7e60f83dd1dfe07a1b6ce60d9675d3616a2ce66) Thanks [@benjamn](https://github.com/benjamn)! - Implement a `@nonreactive` directive for selectively skipping reactive comparisons of query result subtrees.

  The `@nonreactive` directive can be used to mark query fields or fragment spreads and is used to indicate that changes to the data contained within the subtrees marked `@nonreactive` should _not_ trigger re-rendering. This allows parent components to fetch data to be rendered by their children without re-rendering themselves when the data corresponding with fields marked as `@nonreactive` change.

  Consider an `App` component that fetches and renders a list of ski trails:

  <details>
    <summary>View code 🎿</summary>

  ```jsx
  const TrailFragment = gql`
    fragment TrailFragment on Trail {
      name
      status
    }
  `;

  const ALL_TRAILS = gql`
    query allTrails {
      allTrails {
        id
        ...TrailFragment @nonreactive
      }
    }
    ${TrailFragment}
  `;

  function App() {
    const { data, loading } = useQuery(ALL_TRAILS);
    return (
      <main>
        <h2>Ski Trails</h2>
        <ul>
          {data?.trails.map((trail) => (
            <Trail key={trail.id} id={trail.id} />
          ))}
        </ul>
      </main>
    );
  }
  ```

  </details>

  The `Trail` component renders a trail's name and status and allows the user to execute a mutation to toggle the status of the trail between `"OPEN"` and `"CLOSED"`:

  <details>
    <summary>View code 🎿</summary>

  ```jsx
  const Trail = ({ id }) => {
    const [updateTrail] = useMutation(UPDATE_TRAIL);
    const { data } = useFragment({
      fragment: TrailFragment,
      from: {
        __typename: "Trail",
        id,
      },
    });
    return (
      <li key={id}>
        {data.name} - {data.status}
        <input
          checked={data.status === "OPEN" ? true : false}
          type="checkbox"
          onChange={(e) => {
            updateTrail({
              variables: {
                trailId: id,
                status: e.target.checked ? "OPEN" : "CLOSED",
              },
            });
          }}
        />
      </li>
    );
  };
  ```

  </details>

  Notice that the `Trail` component isn't receiving the entire `trail` object via props, only the `id` which is used along with the fragment document to create a live binding for each trail item in the cache. This allows each `Trail` component to react to the cache updates for a single trail independently. Updates to a trail's `status` will not cause the parent `App` component to rerender since the `@nonreactive` directive is applied to the `TrailFragment` spread, a fragment that includes the `status` field.

  For a detailed explanation, see our [`@nonreactive` reference](https://www.apollographql.com/docs/react/data/directives/#nonreactive) and [@alessbell](https://github.com/alessbell)'s [post on the Apollo blog about using `@nonreactive` with `useFragment`](https://www.apollographql.com/blog/apollo-client/introducing-apollo-clients-nonreactive-directive-and-usefragment-hook/).

#### Abort the `AbortController` signal more granularly 🛑

- [#11040](https://github.com/apollographql/apollo-client/pull/11040) [`125ef5b2a`](https://github.com/apollographql/apollo-client/commit/125ef5b2a8fd2de1515b2bdd71785ebab3596cb2) Thanks [@phryneas](https://github.com/phryneas)! - `HttpLink`/`BatchHttpLink`: Abort the `AbortController` signal more granularly.

  Before this change, when `HttpLink`/`BatchHttpLink` created an `AbortController` internally, the signal would always be `.abort`ed after the request was completed. This could cause issues with Sentry Session Replay and Next.js App Router Cache invalidations, which just replayed the fetch with the same options - including the cancelled `AbortSignal`.

  With this change, the `AbortController` will only be `.abort()`ed by outside events, not as a consequence of the request completing.

#### `useFragment` drops its experimental label 🎓

- [#10916](https://github.com/apollographql/apollo-client/pull/10916) [`ea75e18de`](https://github.com/apollographql/apollo-client/commit/ea75e18dec3db090dd4ed3b2d249bf674b90ead4) Thanks [@alessbell](https://github.com/alessbell)! - Remove experimental labels.

  `useFragment`, introduced in `3.7.0` as `useFragment_experimental`, is no longer an experimental API 🎉 We've removed the `_experimental` suffix from its named export and have made a number of improvements.

  For a detailed explanation, see our [`useFragment` reference](https://www.apollographql.com/docs/react/api/react/hooks#usefragment) and [@alessbell](https://github.com/alessbell)'s [post on the Apollo blog](https://www.apollographql.com/blog/apollo-client/introducing-apollo-clients-nonreactive-directive-and-usefragment-hook/) about using `useFragment` with `@nonreactive` for improved performance when rendering lists.

  <details>
  <summary><h5><code>useFragment</code> improvements</h5></summary>

  - [#10765](https://github.com/apollographql/apollo-client/pull/10765) [`35f36c5aa`](https://github.com/apollographql/apollo-client/commit/35f36c5aaefe1f215044e09fdf9386042bc59dd2) Thanks [@phryneas](https://github.com/phryneas)! - More robust types for the `data` property on `UseFragmentResult`. When a partial result is given, the type is now correctly set to `Partial<TData>`.

  - [#11083](https://github.com/apollographql/apollo-client/pull/11083) [`f766e8305`](https://github.com/apollographql/apollo-client/commit/f766e8305d9f2dbde59a61b8e70c99c4b2b67d55) Thanks [@phryneas](https://github.com/phryneas)! - Adjust the rerender timing of `useQuery` to more closely align with `useFragment`. This means that cache updates delivered to both hooks should trigger renders at relatively the same time. Previously, the `useFragment` might rerender much faster leading to some confusion.

  - [#10836](https://github.com/apollographql/apollo-client/pull/10836) [`6794893c2`](https://github.com/apollographql/apollo-client/commit/6794893c29cc945aa99f6fe54a9e4e70ec3e57fd) Thanks [@phryneas](https://github.com/phryneas)! - Remove the deprecated `returnPartialData` option from `useFragment` hook.

  </details>

<details open>
  <summary><h4>More Minor Changes</h4></summary>

- [#10895](https://github.com/apollographql/apollo-client/pull/10895) [`e187866fd`](https://github.com/apollographql/apollo-client/commit/e187866fdfbbd1e1e30646f289367fb4b5afb3c3) Thanks [@Gelio](https://github.com/Gelio)! - Add generic type parameter for the entity modified in `cache.modify`. Improves TypeScript type inference for that type's fields and values of those fields.

  Example:

  ```ts
  cache.modify<Book>({
    id: cache.identify(someBook),
    fields: {
      title: (title) => {
        // title has type `string`.
        // It used to be `any`.
      },
   => {
        // author has type `Reference | Book["author"]`.
        // It used to be `any`.
      },
    },
  });
  ```

- [#10895](https://github.com/apollographql/apollo-client/pull/10895) [`e187866fd`](https://github.com/apollographql/apollo-client/commit/e187866fdfbbd1e1e30646f289367fb4b5afb3c3) Thanks [@Gelio](https://github.com/Gelio)! - Use unique opaque types for the `DELETE` and `INVALIDATE` Apollo cache modifiers.

  This increases type safety, since these 2 modifiers no longer have the `any` type. Moreover, it no longer triggers [the `@typescript-eslint/no-unsafe-return`
  rule](https://typescript-eslint.io/rules/no-unsafe-return/).

- [#10340](https://github.com/apollographql/apollo-client/pull/10340) [`4f73c5ca1`](https://github.com/apollographql/apollo-client/commit/4f73c5ca15d367aa23f02018d062f221c4506a4d) Thanks [@alessbell](https://github.com/alessbell)! - Avoid calling `useQuery` `onCompleted` for cache writes

- [#10527](https://github.com/apollographql/apollo-client/pull/10527) [`0cc7e2e19`](https://github.com/apollographql/apollo-client/commit/0cc7e2e194f84e137a502395f26acdaef392ecae) Thanks [@phryneas](https://github.com/phryneas)! - Remove the `query`/`mutation`/`subscription` option from hooks that already take that value as their first argument.

- [#10506](https://github.com/apollographql/apollo-client/pull/10506) [`2dc2e1d4f`](https://github.com/apollographql/apollo-client/commit/2dc2e1d4f77318d8a4c29445344b4f8c5b08b7e3) Thanks [@phryneas](https://github.com/phryneas)! - prevent accidental widening of inferred `TData` and `TVariables` generics for query hook option arguments

- [#10521](https://github.com/apollographql/apollo-client/pull/10521) [`fbf729414`](https://github.com/apollographql/apollo-client/commit/fbf729414b6322a84158d9864bdfb5b17b2c7d77) Thanks [@benjamn](https://github.com/benjamn)! - Simplify `__DEV__` polyfill to use imports instead of global scope

- [#10994](https://github.com/apollographql/apollo-client/pull/10994) [`2ebbd3abb`](https://github.com/apollographql/apollo-client/commit/2ebbd3abb31224ed383896ebea7c2791c9b42a22) Thanks [@phryneas](https://github.com/phryneas)! - Add .js file extensions to imports in src and dist/\*_/_.d.ts

- [#11045](https://github.com/apollographql/apollo-client/pull/11045) [`9c1d4a104`](https://github.com/apollographql/apollo-client/commit/9c1d4a104d721993b5b306ca4c21724a974e098d) Thanks [@jerelmiller](https://github.com/jerelmiller)! - When changing variables back to a previously used set of variables, do not automatically cache the result as part of the query reference. Instead, dispose of the query reference so that the `InMemoryCache` can determine the cached behavior. This means that fetch policies that would guarantee a network request are now honored when switching back to previously used variables.

- [#11058](https://github.com/apollographql/apollo-client/pull/11058) [`89bf33c42`](https://github.com/apollographql/apollo-client/commit/89bf33c425d08880eeaed4584bdd56c4caf085e7) Thanks [@phryneas](https://github.com/phryneas)! - (Batch)HttpLink: Propagate `AbortError`s to the user when a user-provided `signal` is passed to the link. Previously, these links would swallow all `AbortErrors`, potentially causing queries and mutations to never resolve. As a result of this change, users are now expected to handle `AbortError`s when passing in a user-provided `signal`.

- [#10346](https://github.com/apollographql/apollo-client/pull/10346) [`3bcfc42d3`](https://github.com/apollographql/apollo-client/commit/3bcfc42d394b6a97900495eacdaf58c31ae96d9f) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add the ability to allow `@client` fields to be sent to the link chain.

- [#10567](https://github.com/apollographql/apollo-client/pull/10567) [`c2ce6496c`](https://github.com/apollographql/apollo-client/commit/c2ce6496c10e7ae7e29d25161c2d3cef3e2c6144) Thanks [@benjamn](https://github.com/benjamn)! - Allow `ApolloCache` implementations to specify default value for `assumeImmutableResults` client option, improving performance for applications currently using `InMemoryCache` without configuring `new ApolloClient({ assumeImmutableResults: true })`

- [#10915](https://github.com/apollographql/apollo-client/pull/10915) [`3a62d8228`](https://github.com/apollographql/apollo-client/commit/3a62d8228ab6c15cdb7cd4ea106d13ba3e6f0029) Thanks [@phryneas](https://github.com/phryneas)! - Changes how development-only code is bundled in the library to more reliably enable consuming bundlers to reduce production bundle sizes while keeping compatibility with non-node environments.

</details>

<details open>
  <summary><h3>Patch Changes</h3></summary>

- [#11086](https://github.com/apollographql/apollo-client/pull/11086) [`0264fee06`](https://github.com/apollographql/apollo-client/commit/0264fee066cb715602eda26c7c0bb1254469eccb) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fix an issue where a call to `refetch`, `fetchMore`, or changing `skip` to `false` that returned a result deeply equal to data in the cache would get stuck in a pending state and never resolve.

- [#11053](https://github.com/apollographql/apollo-client/pull/11053) [`c0ca70720`](https://github.com/apollographql/apollo-client/commit/c0ca70720cf5fbedd6e4f128b460c1995d9c55a7) Thanks [@phryneas](https://github.com/phryneas)! - Add `SuspenseCache` as a lazy hidden property on ApolloClient.
  This means that `SuspenseCache` is now an implementation details of Apollo Client and you no longer need to manually instantiate it and no longer need to pass it into `ApolloProvider`. Trying to instantiate a `SuspenseCache` instance in your code will now throw an error.

- [#11115](https://github.com/apollographql/apollo-client/pull/11115) [`78739e3ef`](https://github.com/apollographql/apollo-client/commit/78739e3efe86f6db959dd792d21fa12e0427b12c) Thanks [@phryneas](https://github.com/phryneas)! - Enforce `export type` for all type-level exports.

- [#11027](https://github.com/apollographql/apollo-client/pull/11027) [`e47cfd04e`](https://github.com/apollographql/apollo-client/commit/e47cfd04ec50cb4c19828f4d655eb0f989cdcf7d) Thanks [@phryneas](https://github.com/phryneas)! - Prevents the DevTool installation warning to be turned into a documentation link.

- [#10594](https://github.com/apollographql/apollo-client/pull/10594) [`f221b5e8f`](https://github.com/apollographql/apollo-client/commit/f221b5e8fafef3970af2037218c2396ae7db505e) Thanks [@phryneas](https://github.com/phryneas)! - Add a `suspenseCache` option to `useSuspenseQuery`

- [#10700](https://github.com/apollographql/apollo-client/pull/10700) [`12e37f46f`](https://github.com/apollographql/apollo-client/commit/12e37f46f17f0d5a6d408b89ebafbf7413f309ab) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add a `queryKey` option to `useSuspenseQuery` that allows the hook to create a unique subscription instance.

- [#10724](https://github.com/apollographql/apollo-client/pull/10724) [`e285dfd00`](https://github.com/apollographql/apollo-client/commit/e285dfd003c7074383732ee23e539d7a0316af10) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Automatically strips `__typename` fields from `variables` sent to the server when using [`HttpLink`](https://www.apollographql.com/docs/react/api/link/apollo-link-http), [`BatchHttpLink`](https://www.apollographql.com/docs/react/api/link/apollo-link-batch-http), or [`GraphQLWsLink`](https://www.apollographql.com/docs/react/api/link/apollo-link-subscriptions). This allows GraphQL data returned from a query to be used as an argument to a subsequent GraphQL operation without the need to strip the `__typename` in user-space.

- [#10957](https://github.com/apollographql/apollo-client/pull/10957) [`445164d21`](https://github.com/apollographql/apollo-client/commit/445164d2177efe46637a514afa6a88502d3de10f) Thanks [@phryneas](https://github.com/phryneas)! - Use `React.version` as key for shared Contexts.

- [#10635](https://github.com/apollographql/apollo-client/pull/10635) [`7df51ee19`](https://github.com/apollographql/apollo-client/commit/7df51ee19a49a92f48c0f58f91894d32091cb294) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fix an issue where cache updates would not propagate to `useSuspenseQuery` while in strict mode.

- [#11013](https://github.com/apollographql/apollo-client/pull/11013) [`5ed2cfdaf`](https://github.com/apollographql/apollo-client/commit/5ed2cfdaf9030550d4c82200a5a690b112ad3335) Thanks [@alessbell](https://github.com/alessbell)! - Make private fields `inFlightLinkObservables` and `fetchCancelFns` protected in QueryManager in order to make types available in [`@apollo/experimental-nextjs-app-support`](https://www.npmjs.com/package/@apollo/experimental-nextjs-app-support) package when extending the `ApolloClient` class.

- [#10869](https://github.com/apollographql/apollo-client/pull/10869) [`ba1d06166`](https://github.com/apollographql/apollo-client/commit/ba1d0616618ee040e9bcb20874b03d5783f7eff3) Thanks [@phryneas](https://github.com/phryneas)! - Ensure Context value stability when rerendering ApolloProvider with the same `client` and/or `suspenseCache` prop

- [#11103](https://github.com/apollographql/apollo-client/pull/11103) [`e3d611daf`](https://github.com/apollographql/apollo-client/commit/e3d611daf7a014e5c92d6bed75d67b9187437eda) Thanks [@caylahamann](https://github.com/caylahamann)! - Fixes a bug in `useMutation` so that `onError` is called when an error is returned from the request with `errorPolicy` set to 'all' .

- [#10657](https://github.com/apollographql/apollo-client/pull/10657) [`db305a800`](https://github.com/apollographql/apollo-client/commit/db305a8005664e9b6ec64046da230f41d293104d) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Return `networkStatus` in the `useSuspenseQuery` result.

- [#10937](https://github.com/apollographql/apollo-client/pull/10937) [`eea44eb87`](https://github.com/apollographql/apollo-client/commit/eea44eb87f6f296a6f9978d6ba1cf36e899c9131) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Moves `DocumentTransform` to the `utilities` sub-package to avoid a circular dependency between the `core` and `cache` sub-packages.

- [#10951](https://github.com/apollographql/apollo-client/pull/10951) [`2e833b2ca`](https://github.com/apollographql/apollo-client/commit/2e833b2cacb71fc2050cb3976d0bbe710baeedff) Thanks [@alessbell](https://github.com/alessbell)! - Improve `useBackgroundQuery` type interface

- [#10651](https://github.com/apollographql/apollo-client/pull/10651) [`8355d0e1e`](https://github.com/apollographql/apollo-client/commit/8355d0e1e9c1cee58cabd7df68d3ba09a3afaf6c) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fixes an issue where `useSuspenseQuery` would not respond to cache updates when using a cache-first `fetchPolicy` after the hook was mounted with data already in the cache.

- [#11026](https://github.com/apollographql/apollo-client/pull/11026) [`b8d405eee`](https://github.com/apollographql/apollo-client/commit/b8d405eee2a81df92861be5abd9bd874d7cad111) Thanks [@phryneas](https://github.com/phryneas)! - Store React.Context instance mapped by React.createContext instance, not React.version.
  Using `React.version` can cause problems with `preact`, as multiple versions of `preact` will all identify themselves as React `17.0.2`.

- [#11000](https://github.com/apollographql/apollo-client/pull/11000) [`1d43ab616`](https://github.com/apollographql/apollo-client/commit/1d43ab6169b2b2ebfd8f86366212667f9609f5f5) Thanks [@phryneas](https://github.com/phryneas)! - Use `import * as React` everywhere. This prevents an error when importing `@apollo/client` in a React Server component. (see [#10974](https://github.com/apollographql/apollo-client/issues/10974))

- [#10852](https://github.com/apollographql/apollo-client/pull/10852) [`27fbdb3f9`](https://github.com/apollographql/apollo-client/commit/27fbdb3f9003cc304d26987cb38daf10910f2da6) Thanks [@phryneas](https://github.com/phryneas)! - Chore: Add ESLint rule for consistent type imports, apply autofix

- [#10999](https://github.com/apollographql/apollo-client/pull/10999) [`c1904a78a`](https://github.com/apollographql/apollo-client/commit/c1904a78abb186f475303d632c2cb303bbd8d4f9) Thanks [@phryneas](https://github.com/phryneas)! - Fix a bug in `QueryReference` where `this.resolve` or `this.reject` might be executed even if `undefined`.

- [#10940](https://github.com/apollographql/apollo-client/pull/10940) [`1d38f128f`](https://github.com/apollographql/apollo-client/commit/1d38f128f325ea7092bd04fe3799ebbb6e8bdfdd) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add support for the `skip` option in `useBackgroundQuery` and `useSuspenseQuery`. Setting this option to `true` will avoid a network request.

- [#10672](https://github.com/apollographql/apollo-client/pull/10672) [`932252b0c`](https://github.com/apollographql/apollo-client/commit/932252b0c54792ec8c5095de1b42c005a91ffe6d) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fix the compatibility between `useSuspenseQuery` and React's `useDeferredValue` and `startTransition` APIs to allow React to show stale UI while the changes to the variable cause the component to suspend.

  #### Breaking change

  `nextFetchPolicy` support has been removed from `useSuspenseQuery`. If you are using this option, remove it, otherwise it will be ignored.

- [#10964](https://github.com/apollographql/apollo-client/pull/10964) [`f33171506`](https://github.com/apollographql/apollo-client/commit/f331715066d65291b1f5df5e6fa2b6618dfc70b1) Thanks [@alessbell](https://github.com/alessbell)! - Fixes a bug in `BatchHttpLink` that removed variables from all requests by default.

- [#10633](https://github.com/apollographql/apollo-client/pull/10633) [`90a06eeeb`](https://github.com/apollographql/apollo-client/commit/90a06eeeb5a50eb172f5c6211693ea051897d8f3) Thanks [@benjamn](https://github.com/benjamn)! - Fix type policy inheritance involving fuzzy `possibleTypes`

- [#10754](https://github.com/apollographql/apollo-client/pull/10754) [`64b304862`](https://github.com/apollographql/apollo-client/commit/64b3048621de35bbfe9bdf47785a2d5583232830) Thanks [@sincraianul](https://github.com/sincraianul)! - Fix `includeUnusedVariables` option not working with `BatchHttpLink`

- [#11018](https://github.com/apollographql/apollo-client/pull/11018) [`5618953f3`](https://github.com/apollographql/apollo-client/commit/5618953f332a10c7df1b385126ec714aa5809c48) Thanks [@jerelmiller](https://github.com/jerelmiller)! - `useBackgroundQuery` now uses its own options type called `BackgroundQueryHookOptions` rather than reusing `SuspenseQueryHookOptions`.

- [#11035](https://github.com/apollographql/apollo-client/pull/11035) [`a3ab7456d`](https://github.com/apollographql/apollo-client/commit/a3ab7456d59be4a7beb58d0aff6d431c603448f5) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Incrementally re-render deferred queries after calling `refetch` or setting `skip` to `false` to match the behavior of the initial fetch. Previously, the hook would not re-render until the entire result had finished loading in these cases.

- [#10399](https://github.com/apollographql/apollo-client/pull/10399) [`652a1ae08`](https://github.com/apollographql/apollo-client/commit/652a1ae0868e4a5b75b9ff656d26f57eeca1081a) Thanks [@alessbell](https://github.com/alessbell)! - Silence useLayoutEffect warning when useSuspenseQuery runs on server

- [#10919](https://github.com/apollographql/apollo-client/pull/10919) [`f796ce1ac`](https://github.com/apollographql/apollo-client/commit/f796ce1ac72f31a951a1d0f0b78d19dd039a6398) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fix an issue when using a link that relied on `operation.getContext` and `operation.setContext` would error out when it was declared after the `removeTypenameFromVariables` link.

- [#10968](https://github.com/apollographql/apollo-client/pull/10968) [`b102390b2`](https://github.com/apollographql/apollo-client/commit/b102390b238e5ce083062541d98a00fc3a10e1e1) Thanks [@phryneas](https://github.com/phryneas)! - Use printed query for query deduplication. Cache `print` calls for GraphQL documents to speed up repeated operations.

- [#11071](https://github.com/apollographql/apollo-client/pull/11071) [`4473e925a`](https://github.com/apollographql/apollo-client/commit/4473e925ac5d6a53dc2b34867f034eda1b05aa00) Thanks [@jerelmiller](https://github.com/jerelmiller)! - [#10509](https://github.com/apollographql/apollo-client/pull/10509) introduced some helpers for determining the type of operation for a GraphQL query. This imported the `OperationTypeNode` from graphql-js which is not available in GraphQL 14. To maintain compatibility with graphql-js v14, this has been reverted to use plain strings.

- [#10766](https://github.com/apollographql/apollo-client/pull/10766) [`ffb179e55`](https://github.com/apollographql/apollo-client/commit/ffb179e5553fa6f9156ae0aaf782dfcbec7d08c7) Thanks [@jerelmiller](https://github.com/jerelmiller)! - More robust typings for the `data` property returned from `useSuspenseQuery` when using `returnPartialData: true` or an `errorPolicy` of `all` or `ignore`. `TData` now defaults to `unknown` instead of `any`.

- [#10401](https://github.com/apollographql/apollo-client/pull/10401) [`3e5b41a75`](https://github.com/apollographql/apollo-client/commit/3e5b41a751673bb2120c0b624e22afd3b7b860e5) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Always throw network errors in `useSuspenseQuery` regardless of the set `errorPolicy`.

- [#10877](https://github.com/apollographql/apollo-client/pull/10877) [`f40248598`](https://github.com/apollographql/apollo-client/commit/f402485985cc2551b51602c0bff213b7ffb856b9) Thanks [@phryneas](https://github.com/phryneas)! - Change an import in `useQuery` and `useMutation` that added an unnecessary runtime dependency on `@apollo/client/core`. This drastically reduces the bundle size of each the hooks.

- [#10656](https://github.com/apollographql/apollo-client/pull/10656) [`54c4d2f3c`](https://github.com/apollographql/apollo-client/commit/54c4d2f3c719654e38e537ec38f1cb415c7c3f58) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Ensure `refetch`, `fetchMore`, and `subscribeToMore` functions returned by `useSuspenseQuery` are referentially stable between renders, even as `data` is updated.

- [#10324](https://github.com/apollographql/apollo-client/pull/10324) [`95eb228be`](https://github.com/apollographql/apollo-client/commit/95eb228bedc193a520604e351d1c455bfbedef06) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add `@defer` support to `useSuspenseQuery`.

- [#10888](https://github.com/apollographql/apollo-client/pull/10888) [`1562a2f5a`](https://github.com/apollographql/apollo-client/commit/1562a2f5a91cf577d9c89c4e84088a6bccc73c28) Thanks [@alessbell](https://github.com/alessbell)! - Updates dependency versions in `package.json` by bumping:

  - `@wry/context` to `^0.7.3`
  - `@wry/equality` to `^0.5.6`
  - `@wry/trie` to `^0.4.3`
  - `optimism` to `^0.17.4`

  to 1. [fix sourcemap warnings](https://github.com/benjamn/wryware/pull/497) and 2. a Codesandbox [sandpack (in-browser) bundler transpilation bug](https://github.com/codesandbox/sandpack/issues/940) with an [upstream optimism workaround](https://github.com/benjamn/optimism/pull/550).

- [#11010](https://github.com/apollographql/apollo-client/pull/11010) [`1051a9c88`](https://github.com/apollographql/apollo-client/commit/1051a9c888ba86511b7fcb80a26d3b3050359258) Thanks [@alessbell](https://github.com/alessbell)! - Hide queryRef in a Symbol in `useBackgroundQuery`s return value.

- [#10758](https://github.com/apollographql/apollo-client/pull/10758) [`9def7421f`](https://github.com/apollographql/apollo-client/commit/9def7421f3d028c91fcaa7971878b3da8281424d) Thanks [@phryneas](https://github.com/phryneas)! - use `React.use` where available

- [#11032](https://github.com/apollographql/apollo-client/pull/11032) [`6a4da900a`](https://github.com/apollographql/apollo-client/commit/6a4da900a1bc5da3524caabd64bb30945e66f675) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Throw errors in `useSuspenseQuery` for errors returned in incremental chunks when `errorPolicy` is `none`. This provides a more consistent behavior of the `errorPolicy` in the hook.

  #### Potentially breaking change

  Previously, if you issued a query with `@defer` and relied on `errorPolicy: 'none'` to set the `error` property returned from `useSuspenseQuery` when the error was returned in an incremental chunk, this error is now thrown. Switch the `errorPolicy` to `all` to avoid throwing the error and instead return it in the `error` property.

- [#10960](https://github.com/apollographql/apollo-client/pull/10960) [`ee407ef97`](https://github.com/apollographql/apollo-client/commit/ee407ef97317bf29c554732237aaf11552e06b01) Thanks [@alessbell](https://github.com/alessbell)! - Adds support for `returnPartialData` and `refetchWritePolicy` options in `useBackgroundQuery` hook.

- [#10809](https://github.com/apollographql/apollo-client/pull/10809) [`49d28f764`](https://github.com/apollographql/apollo-client/commit/49d28f764980d132089ef8f6beca6e766b6120c0) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Fixed the ability to use `refetch` and `fetchMore` with React's `startTransition`. The hook will now behave correctly by allowing React to avoid showing the Suspense fallback when these functions are wrapped by `startTransition`. This change deprecates the `suspensePolicy` option in favor of `startTransition`.

- [#11082](https://github.com/apollographql/apollo-client/pull/11082) [`0f1cde3a2`](https://github.com/apollographql/apollo-client/commit/0f1cde3a207699edb742dfaada817a815488d594) Thanks [@phryneas](https://github.com/phryneas)! - Restore Apollo Client 3.7 `getApolloContext` behaviour

- [#10969](https://github.com/apollographql/apollo-client/pull/10969) [`525a9317a`](https://github.com/apollographql/apollo-client/commit/525a9317af729309f699fd6f8b787647a5f63eac) Thanks [@phryneas](https://github.com/phryneas)! - Slightly decrease bundle size and memory footprint of `SuspenseCache` by changing how cache entries are stored internally.

- [#11025](https://github.com/apollographql/apollo-client/pull/11025) [`6092b6edf`](https://github.com/apollographql/apollo-client/commit/6092b6edf67ef311954c18c778ed0bdca1b77258) Thanks [@jerelmiller](https://github.com/jerelmiller)! - `useSuspenseQuery` and `useBackgroundQuery` will now properly apply changes to its options between renders.

- [#10872](https://github.com/apollographql/apollo-client/pull/10872) [`96b4f8837`](https://github.com/apollographql/apollo-client/commit/96b4f8837881db67e951272b775dc62282e50d49) Thanks [@phryneas](https://github.com/phryneas)! - The "per-React-Version-Singleton" ApolloContext is now stored on `globalThis`, not `React.createContext`, and throws an error message when accessed from React Server Components.

- [#10450](https://github.com/apollographql/apollo-client/pull/10450) [`f8bc33387`](https://github.com/apollographql/apollo-client/commit/f8bc33387f66e28456aede53bae75694c9a7a45f) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add support for the `subscribeToMore` and `client` fields returned in the `useSuspenseQuery` result.

</details>

## 3.7.17

### Patch Changes

- [#10631](https://github.com/apollographql/apollo-client/pull/10631) [`b93388d75`](https://github.com/apollographql/apollo-client/commit/b93388d7582d88859c4975dff524c1ceb5bd2b4e) Thanks [@phryneas](https://github.com/phryneas)! - ObservableQuery.getCurrentResult: skip the cache if the running query should not access the cache

## 3.7.16

### Patch Changes

- [#10806](https://github.com/apollographql/apollo-client/pull/10806) [`cb1540504`](https://github.com/apollographql/apollo-client/commit/cb15405041e0bd644fcf23d1b8fcaa09762c5a6a) Thanks [@phryneas](https://github.com/phryneas)! - Fix a bug in `PersistedQueryLink` that would cause it to permanently skip persisted queries after a 400 or 500 status code.

- [#10807](https://github.com/apollographql/apollo-client/pull/10807) [`b32369592`](https://github.com/apollographql/apollo-client/commit/b3236959269ce27b18b8c2cae72106098a3ba1b8) Thanks [@phryneas](https://github.com/phryneas)! - `PersistedQueryLink` will now also check for error codes in `extensions`.

- [#10982](https://github.com/apollographql/apollo-client/pull/10982) [`b9be7a814`](https://github.com/apollographql/apollo-client/commit/b9be7a814a64fc6b3e6ce23dd97a4f0c7140aba7) Thanks [@sdeleur-sc](https://github.com/sdeleur-sc)! - Update `relayStylePagination` to avoid populating `startCursor` when only a single cursor is present under the `edges` field. Use that cursor only as the `endCursor`.

- [#10962](https://github.com/apollographql/apollo-client/pull/10962) [`772cfa3cb`](https://github.com/apollographql/apollo-client/commit/772cfa3cb563dccee878177e58c8250c4e5b5013) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Remove `useGETForQueries` option in `BatchHttpLink.Options` type since it is not supported.

## 3.7.15

### Patch Changes

- [#10891](https://github.com/apollographql/apollo-client/pull/10891) [`ab42a5c08`](https://github.com/apollographql/apollo-client/commit/ab42a5c08840193cb915f4e66d71fac3834fec68) Thanks [@laverdet](https://github.com/laverdet)! - Fixes a bug in how multipart responses are read when using `@defer`. When reading a multipart body, `HttpLink` no longer attempts to parse the boundary (e.g. `"---"` or other boundary string) within the response data itself, only when reading the beginning of each mulitpart chunked message.

- [#10789](https://github.com/apollographql/apollo-client/pull/10789) [`23a4e1578`](https://github.com/apollographql/apollo-client/commit/23a4e15786fe99658d741585366f3b02bcffb97f) Thanks [@phryneas](https://github.com/phryneas)! - Fix a bug where other fields could be aliased to `__typename` or `id`, in which case an incoming result would be merged into the wrong cache entry.

## 3.7.14

### Patch Changes

- [#10764](https://github.com/apollographql/apollo-client/pull/10764) [`1b0a61fe5`](https://github.com/apollographql/apollo-client/commit/1b0a61fe5a6593f319da26fec8692359232ccf9b) Thanks [@phryneas](https://github.com/phryneas)! - Deprecate `useFragment` `returnPartialData` option

- [#10810](https://github.com/apollographql/apollo-client/pull/10810) [`a6252774f`](https://github.com/apollographql/apollo-client/commit/a6252774f43fd9a4be9c50b48b7a6d5a1c8e64ec) Thanks [@dleavitt](https://github.com/dleavitt)! - Fix type signature of `ServerError`.

  In <3.7 `HttpLink` and `BatchHttpLink` would return a `ServerError.message` of e.g. `"Unexpected token 'E', \"Error! Foo bar\" is not valid JSON"` and a `ServerError.result` of `undefined` in the case where a server returned a >= 300 response code with a response body containing a string that could not be parsed as JSON.

  In >=3.7, `message` became e.g. `Response not successful: Received status code 302` and `result` became the string from the response body, however the type in `ServerError.result` was not updated to include the `string` type, which is now properly reflected.

## 3.7.13

### Patch Changes

- [#10805](https://github.com/apollographql/apollo-client/pull/10805) [`a5503666c`](https://github.com/apollographql/apollo-client/commit/a5503666c2cc8220ac1d877e3296556e54e58ff6) Thanks [@phryneas](https://github.com/phryneas)! - Fix a potential memory leak in SSR scenarios when many `persistedQuery` instances were created over time.

- [#10718](https://github.com/apollographql/apollo-client/pull/10718) [`577c68bdd`](https://github.com/apollographql/apollo-client/commit/577c68bdd26519f8341fd1188ea4b8aabe357856) Thanks [@Hsifnus](https://github.com/Hsifnus)! - Delay Concast subscription teardown slightly in `useSubscription` to prevent unexpected Concast teardown when one `useSubscription` hook tears down its in-flight Concast subscription immediately followed by another `useSubscription` hook reusing and subscribing to that same Concast

## 3.7.12

### Patch Changes

- [#10735](https://github.com/apollographql/apollo-client/pull/10735) [`895bcdcff`](https://github.com/apollographql/apollo-client/commit/895bcdcff146bc4575c8f3423c30fa9e885be16b) Thanks [@alessbell](https://github.com/alessbell)! - If a multipart chunk contains only `hasNext: false`, immediately complete the observable.

## 3.7.11

### Patch Changes

- [#10586](https://github.com/apollographql/apollo-client/pull/10586) [`4175af594`](https://github.com/apollographql/apollo-client/commit/4175af59419dbb698c32c074f44229f3a5b3b83d) Thanks [@alessbell](https://github.com/alessbell)! - Improve WebSocket error handling for generic `Event` received on error. For more information see [https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/error_event](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/error_event).

- [#10411](https://github.com/apollographql/apollo-client/pull/10411) [`152baac34`](https://github.com/apollographql/apollo-client/commit/152baac343b8b68c7a2d4691d5dc60d9e43e62bb) Thanks [@lovasoa](https://github.com/lovasoa)! - Simplify error message generation and make 'undefined' an impossible message string.

- [#10592](https://github.com/apollographql/apollo-client/pull/10592) [`cdb98ae08`](https://github.com/apollographql/apollo-client/commit/cdb98ae082ae4c7da6cd6a0fd5ad8457810fceda) Thanks [@alessbell](https://github.com/alessbell)! - Adds support for multipart subscriptions in `HttpLink`.

- [#10698](https://github.com/apollographql/apollo-client/pull/10698) [`38508a251`](https://github.com/apollographql/apollo-client/commit/38508a251423057fd8a0df50230f50e0a5dde5fd) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Changes the behavior of `useLazyQuery` introduced in [#10427](https://github.com/apollographql/apollo-client/pull/10427) where unmounting a component before a query was resolved would reject the promise with an abort error. Instead, the promise will now resolve naturally with the result from the request.

  Other notable fixes:

  - Kicking off multiple requests in parallel with the execution function will now ensure each returned promise is resolved with the data from its request. Previously, each promise was resolved with data from the last execution.
  - Re-rendering `useLazyQuery` with a different query document will now ensure the execution function uses the updated query document. Previously, only the query document rendered the first time would be used for the request.

- [#10660](https://github.com/apollographql/apollo-client/pull/10660) [`364bee98f`](https://github.com/apollographql/apollo-client/commit/364bee98fe193a7915664c1a5b206fd52793f85a) Thanks [@alessbell](https://github.com/alessbell)! - Upgrades TypeScript to v5. This change is fully backward-compatible and transparent to users.

- [#10597](https://github.com/apollographql/apollo-client/pull/10597) [`8fb9d190d`](https://github.com/apollographql/apollo-client/commit/8fb9d190dbf48147412517643e3e425a7d48c49c) Thanks [@phryneas](https://github.com/phryneas)! - Fix a bug where an incoming cache update could prevent future updates from the active link.

- [#10629](https://github.com/apollographql/apollo-client/pull/10629) [`02605bb3c`](https://github.com/apollographql/apollo-client/commit/02605bb3c9e148bf87a6e52b4a9ecc7d523ef9f6) Thanks [@phryneas](https://github.com/phryneas)! - `useQuery`: delay unsubscribe to fix race conditions

## 3.7.10

### Patch Changes

- [#9438](https://github.com/apollographql/apollo-client/pull/9438) [`52a9c8ea1`](https://github.com/apollographql/apollo-client/commit/52a9c8ea1ac08ee53fe1ddbd4ded899ea00a1f9f) Thanks [@dciesielkiewicz](https://github.com/dciesielkiewicz)! - Ensure the `client` option passed to `useMutation`'s execute function is used when provided. Previously this option was ignored.

- [#9124](https://github.com/apollographql/apollo-client/pull/9124) [`975b923c0`](https://github.com/apollographql/apollo-client/commit/975b923c0c0e7ddc8553917a91981e9f41713bc1) Thanks [@andrebrantom](https://github.com/andrebrantom)! - Make `ApolloClient.writeQuery` and `ApolloClient.writeFragment` behave more like `cache.writeQuery` and `cache.writeFragment` by returning the reference returned by the cache.

## 3.7.9

### Patch Changes

- [#10560](https://github.com/apollographql/apollo-client/pull/10560) [`a561ecf43`](https://github.com/apollographql/apollo-client/commit/a561ecf4306c56770ba0713f0136174275887f1a) Thanks [@benjamn](https://github.com/benjamn)! - Keep `__typename` fragment when it does not contain `@client` directive and strip out inline fragments which use a `@client` directive. Thanks @Gazler and @mtsmfm!

- [#10560](https://github.com/apollographql/apollo-client/pull/10560) [`251a12806`](https://github.com/apollographql/apollo-client/commit/251a12806d1fa38bc8723540fb2d696c39db1097) Thanks [@benjamn](https://github.com/benjamn)! - Refactor `removeDirectivesFromDocument` to fix AST ordering sensitivities and avoid 1/3 AST traversals, potentially improving performance for large queries

## 3.7.8

### Patch Changes

- [#7555](https://github.com/apollographql/apollo-client/pull/7555) [`45562d6fa`](https://github.com/apollographql/apollo-client/commit/45562d6fa20eab658bd86d79d092862ace4e1225) Thanks [@TheCeloReis](https://github.com/TheCeloReis)! - Adds `TVariables` generic to `GraphQLRequest` and `MockedResponse` interfaces.

- [#10526](https://github.com/apollographql/apollo-client/pull/10526) [`1d13de4f1`](https://github.com/apollographql/apollo-client/commit/1d13de4f190150e96d61a9e987274ee6c249dbef) Thanks [@benjamn](https://github.com/benjamn)! - Tolerate undefined `concast.sources` if `complete` called earlier than `concast.start`

- [#10497](https://github.com/apollographql/apollo-client/pull/10497) [`8a883d8a1`](https://github.com/apollographql/apollo-client/commit/8a883d8a1c8899f94a3e2ae09cb2069bde2b2150) Thanks [@nevir](https://github.com/nevir)! - Update `SingleExecutionResult` and `IncrementalPayload`'s `data` types such that they no longer include `undefined`, which was not a valid runtime value, to fix errors when TypeScript's `exactOptionalPropertyTypes` is enabled.

## 3.7.7

### Patch Changes

- [#10502](https://github.com/apollographql/apollo-client/pull/10502) [`315faf9ca`](https://github.com/apollographql/apollo-client/commit/315faf9ca5b326852919ab7fc2082d6ba92bcb59) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Log a warning to the console when a mock passed to `MockedProvider` or `MockLink` cannot be matched to a query during a test. This makes it easier to debug user errors in the mock setup, such as typos, especially if the query under test is using an `errorPolicy` set to `ignore`, which makes it difficult to know that a match did not occur.

- [#10499](https://github.com/apollographql/apollo-client/pull/10499) [`9e54f5dfa`](https://github.com/apollographql/apollo-client/commit/9e54f5dfa05fd363e534c432ba8c569bb96a6e35) Thanks [@phryneas](https://github.com/phryneas)! - Allow the execution function returned by `useLazyQuery` to change the query.

- [#10362](https://github.com/apollographql/apollo-client/pull/10362) [`14a56b105`](https://github.com/apollographql/apollo-client/commit/14a56b105fefcbb2ce5daa9fd6924e5decafcc16) Thanks [@mccraveiro](https://github.com/mccraveiro)! - Fix error when server returns an error and we are also querying for a local field

## 3.7.6

### Patch Changes

- [#10470](https://github.com/apollographql/apollo-client/pull/10470) [`47435e879`](https://github.com/apollographql/apollo-client/commit/47435e879ebc867d9fc3de5b6fd5785204b4dbd4) Thanks [@alessbell](https://github.com/alessbell)! - Bumps TypeScript to `4.9.4` (previously `4.7.4`) and updates types to account for changes in TypeScript 4.8 by [propagating contstraints on generic types](https://devblogs.microsoft.com/typescript/announcing-typescript-4-8/#unconstrained-generics-no-longer-assignable-to). Technically this makes some types stricter as attempting to pass `null|undefined` into certain functions is now disallowed by TypeScript, but these were never expected runtime values in the first place.
  This should only affect you if you are wrapping functions provided by Apollo Client with your own abstractions that pass in their generics as type arguments, in which case you might get an error like `error TS2344: Type 'YourGenericType' does not satisfy the constraint 'OperationVariables'`. In that case, make sure that `YourGenericType` is restricted to a type that only accepts objects via `extends`, like `Record<string, any>` or `@apollo/client`'s `OperationVariables`:

  ```diff
  import {
    QueryHookOptions,
    QueryResult,
    useQuery,
  + OperationVariables,
  } from '@apollo/client';
  - export function useWrappedQuery<T, TVariables>(
  + export function useWrappedQuery<T, TVariables extends OperationVariables>(
      query: DocumentNode,
      queryOptions: QueryHookOptions<T, TVariables>
    ): QueryResult<T, TVariables> {
      const [execute, result] = useQuery<T, TVariables>(query);
    }
  ```

- [#10408](https://github.com/apollographql/apollo-client/pull/10408) [`55ffafc58`](https://github.com/apollographql/apollo-client/commit/55ffafc585e9eb66314755b4f40804b8b8affb13) Thanks [@zlrlo](https://github.com/zlrlo)! - fix: modify BatchHttpLink to have a separate timer for each different batch key

- [#9573](https://github.com/apollographql/apollo-client/pull/9573) [`4a4f48dda`](https://github.com/apollographql/apollo-client/commit/4a4f48dda8dd290ef110aed9e4e73d0c1c977c31) Thanks [@vladar](https://github.com/vladar)! - Improve performance of local resolvers by only executing selection sets that contain an `@client` directive. Previously, local resolvers were executed even when the field did not contain `@client`. While the result was properly discarded, the unncessary work could negatively affect query performance, sometimes signficantly.

## 3.7.5

### Patch Changes

- [#10458](https://github.com/apollographql/apollo-client/pull/10458) [`b5ccef229`](https://github.com/apollographql/apollo-client/commit/b5ccef229046d230e82a68a4834ac09ae1ef2009) Thanks [@lennyburdette](https://github.com/lennyburdette)! - Passes `getServerSnapshot` to `useSyncExternalStore` so that it doesn't trigger a `Missing getServerSnapshot` error when using `useFragment_experimental` on the server.

- [#10471](https://github.com/apollographql/apollo-client/pull/10471) [`895ddcb54`](https://github.com/apollographql/apollo-client/commit/895ddcb546b5692cd53caae1b604412728641374) Thanks [@alessbell](https://github.com/alessbell)! - More robust type definition for `headers` property passed to `createHttpLink`

- [#10321](https://github.com/apollographql/apollo-client/pull/10321) [`bbaa3ef2d`](https://github.com/apollographql/apollo-client/commit/bbaa3ef2d95a03e2453ef86a25096c314fbd8998) Thanks [@alessbell](https://github.com/alessbell)! - Refetch should not return partial data with `errorPolicy: none` and `notifyOnNetworkStatusChange: true`.

- [#10402](https://github.com/apollographql/apollo-client/pull/10402) [`0b07aa955`](https://github.com/apollographql/apollo-client/commit/0b07aa955bab2e929f21590b565507a66f930539) Thanks [@Hugodby](https://github.com/Hugodby)! - Improve context types

- [#10469](https://github.com/apollographql/apollo-client/pull/10469) [`328c58f90`](https://github.com/apollographql/apollo-client/commit/328c58f90d3fd985a58a68d8ba07f7c03f9808f6) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add generic type defaults when using `useFragment` to allow passing `TData` directly to the function without needing to specify `TVars`.

## 3.7.4

### Patch Changes

- [#10427](https://github.com/apollographql/apollo-client/pull/10427) [`28d909cff`](https://github.com/apollographql/apollo-client/commit/28d909cff086f8352e2ea75421a1cac590917573) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Ensure in-flight promises executed by `useLazyQuery` are rejected when `useLazyQuery` unmounts.

- [#10383](https://github.com/apollographql/apollo-client/pull/10383) [`5c5ca9b01`](https://github.com/apollographql/apollo-client/commit/5c5ca9b01a2b9905f94de85e5b80ffc29522e2e3) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Ensure the `onError` callback is called when the `errorPolicy` is set to "all" and partial data is returned.

- [#10425](https://github.com/apollographql/apollo-client/pull/10425) [`86e35a6d2`](https://github.com/apollographql/apollo-client/commit/86e35a6d25e9838f39a9de652e52a358b9c08488) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Prefer the `onError` and `onCompleted` callback functions passed to the execute function returned from `useMutation` instead of calling both callback handlers.

## 3.7.3

### Patch Changes

- [#10334](https://github.com/apollographql/apollo-client/pull/10334) [`7d923939d`](https://github.com/apollographql/apollo-client/commit/7d923939dd7e6db7d69f04f598c666104b076e78) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Better handle deferred queries that have cached or partial cached data for them

- [#10368](https://github.com/apollographql/apollo-client/pull/10368) [`46b58e976`](https://github.com/apollographql/apollo-client/commit/46b58e9762abbffaee5c9abda8e309bea6d7a785) Thanks [@alessbell](https://github.com/alessbell)! - Fix: unblocks support for defer in mutations

  If the `@defer` directive is present in the document passed to `mutate`, the Promise will resolve with the final merged data after the last multipart chunk has arrived in the response.

## 3.7.2

### Patch Changes

- Only show dev tools suggestion in the console when `connectToDevTools` is `true`. <br/>
  [@chris110408](https://github.com/chris110408) in [#10258](https://github.com/apollographql/apollo-client/pull/10258)

- Pass `TCache` generic to `MutationHookOptions` for better type support in `useMutation`. <br />
  [@igrlk](https://github.com/igrlk) in [#10223](https://github.com/apollographql/apollo-client/pull/10223)

- Add `name` property to `ApolloError` to ensure better type safety and help error reporting tools better identify the error. <br />
  [@aaronadamsCA](https://github.com/aaronadamsCA) in [#9323](https://github.com/apollographql/apollo-client/pull/9323)

- Export a `ModifierDetails` type for the `details` parameter of a `Modifier` function. <br />
  [@KeithGillette](https://github.com/KeithGillette) in [#7133](https://github.com/apollographql/apollo-client/pull/7133)

- Revert use of `cloneDeep` to clone options when fetching queries. <br />
  [@MrDoomBringer](https://github.com/MrDoomBringer) in [#10215](https://github.com/apollographql/apollo-client/pull/10215)

## 3.7.1

### Patch Changes

- Fix issue where `loading` remains `true` after `observer.refetch` is called repeatedly with different variables when the same data are returned. <br/>
  [@alessbell](https://github.com/alessbell) in [#10143](https://github.com/apollographql/apollo-client/pull/10143)

- Fix race condition where `useFragment_experimental` could receive cache updates before initially calling `cache.watch` in `useEffect`. <br/>
  [@benjamn](https://github.com/benjamn) in [#10212](https://github.com/apollographql/apollo-client/pull/10212)

## 3.7.0

### Minor Changes

- Implement preview support for the [`@defer` directive](https://github.com/graphql/graphql-spec/pull/742). <br/>
  [@alessbell](https://github.com/alessbell) and [@benjamn](https://github.com/benjamn) in [#10018](https://github.com/apollographql/apollo-client/pull/10018)

- Implement `useFragment_experimental` hook, which represents a lightweight live binding into the `ApolloCache`, and never triggers network requests of its own. <br/>
  [@benjamn](https://github.com/benjamn) in [#8782](https://github.com/apollographql/apollo-client/pull/8782)

- Allow registering named fragments with `InMemoryCache` to support using `...NamedFragment` in queries without redeclaring `NamedFragment` repeatedly in every query that uses it. <br/>
  [@benjamn](https://github.com/benjamn) in [#9764](https://github.com/apollographql/apollo-client/pull/9764)

- Support `onError` callback for `useSubscription` hook. <br/>
  [@jeroenvisser101](https://github.com/jeroenvisser101) in [#9495](https://github.com/apollographql/apollo-client/pull/9495)

- Implement `preserveHeaderCase` option for `http` context object, enabling preserved header capitalization for non-http-spec-compliant servers. <br/>
  [@mrdoombringer](https://github.com/mrdoombringer) in [#9891](https://github.com/apollographql/apollo-client/pull/9891)

### Patch Changes

- Delay calling `onCompleted` and `onError` callbacks passed to `useQuery` using `Promise.resolve().then(() => ...)` to fix issue [#9794](https://github.com/apollographql/apollo-client/pull/9794). <br/>
  [@dylanwulf](https://github.com/dylanwulf) in [#9823](https://github.com/apollographql/apollo-client/pull/9823)

- Replace `concast.cleanup` method with simpler `concast.beforeNext` API, which promises to call the given callback function just before the next result/error is delivered. In addition, `concast.removeObserver` no longer takes a `quietly?: boolean` parameter, since that parameter was partly responsible for cleanup callbacks sometimes not getting called. <br/>
  [@benjamn](https://github.com/benjamn) in [#9718](https://github.com/apollographql/apollo-client/pull/9718)

- Allow preserving header name capitalization when creating an `HttpLink` with `createHttpLink({ uri, preserveHeaderCase: true })`. Otherwise, header names are converted to lowercase to prevent case-sensitivity bugs. <br/>
  [@MrDoomBringer](https://github.com/MrDoomBringer) in [#9891](https://github.com/apollographql/apollo-client/pull/9891)

- Make queries with a `pollInterval` respect the `no-cache` fetch policy, instead of writing polled results into the cache. <br/>
  [@MrDoomBringer](https://github.com/MrDoomBringer) in [#10020](https://github.com/apollographql/apollo-client/pull/10020)

- Deprecate the `onSubscriptionData` callback in favor of a new `onData` callback for the `useSubscription` hook. Deprecate the `onSubscriptionComplete` callback in favor of a new `onComplete` callback for the `useSubscription` hook.<br/>
  [@jerelmiller](https://github.com/jerelmiller) in [#10134](https://github.com/apollographql/apollo-client/pull/10134)

### Potentially disruptive

- The optional `subscribeAndCount` testing utility exported from `@apollo/client/testing/core` now takes a single generic `TResult` type parameter, instead of `TData`. This type will typically be inferred from the `observable` argument type, but if you have any explicit calls to `subscribeAndCount<TData>(...)` in your own codebase, you may need to adjust those calls accordingly. <br/>
  [@benjamn](https://github.com/benjamn) in [#9718](https://github.com/apollographql/apollo-client/pull/9718)

## Apollo Client 3.6.10 (2022-09-29)

### Improvements

- The client options (`variables`, `context`, etc.) used for `mutation` calls are now available as the second argument to the `onCompleted` and `onError` callback functions. <br/>
  [@MrDoomBringer](https://github.com/MrDoomBringer) in [#10052](https://github.com/apollographql/apollo-client/pull/10052)

## Apollo Client 3.6.9 (2022-06-21)

### Bug Fixes

- Leave `fetchPolicy` unchanged when `skip: true` (or in standby) and `nextFetchPolicy` is available, even if `variables` change. <br/>
  [@benjamn](https://github.com/benjamn) in [#9823](https://github.com/apollographql/apollo-client/pull/9823)

## Apollo Client 3.6.8 (2022-06-10)

### Bug Fixes

- Fix incorrect `variables` passed in `FieldFunctionOptions` for nested `readField` calls in `read` and `merge` functions. <br/>
  [@stardustxx](https://github.com/stardustxx) in [#9808](https://github.com/apollographql/apollo-client/pull/9808)

- Improve repository build scripts to work better on Windows. <br/>
  [@dylanwulf](https://github.com/dylanwulf) in [#9805](https://github.com/apollographql/apollo-client/pull/9805)

- Ensure `useQuery(query, { skip: true }).called === false` rather than always returning `called` as `true`. <br/>
  [@KucharskiPiotr](https://github.com/KucharskiPiotr) in [#9798](https://github.com/apollographql/apollo-client/pull/9798)

- Allow abandoned `reobserve` requests to unsubscribe from their underlying `Observable`. <br/>
  [@javier-garcia-meteologica](https://github.com/javier-garcia-meteologica) in [#9791](https://github.com/apollographql/apollo-client/pull/9791)

## Apollo Client 3.6.7 (2022-06-10)

### Bug Fixes

- Fix regression (introduced in v3.6.0) that caused `BatchHttpLink` to discard pending batched queries on early completion of the underlying `Observable`. <br/>
  [@benjamn](https://github.com/benjamn) in [#9793](https://github.com/apollographql/apollo-client/pull/9793)

## Apollo Client 3.6.6 (2022-05-26)

### Bug Fixes

- Allow `useLazyQuery(query, { defaultOptions })` to benefit from `defaultOptions.variables` and `client.defaultOptions.watchQuery.variables` merging. <br/>
  [@benjamn](https://github.com/benjamn) in [#9762](https://github.com/apollographql/apollo-client/pull/9762)

## Apollo Client 3.6.5 (2022-05-23)

### Bug Fixes

- Restore pre-v3.6 `variables` replacement behavior of `ObservableQuery#reobserve` method, fixing a regression that prevented removal of variables. <br/>
  [@benjamn](https://github.com/benjamn) in [#9741](https://github.com/apollographql/apollo-client/pull/9741)

- Preserve `previousData` even when different query or client provided to `useQuery`, instead of resetting `previousData` to undefined in those cases, matching behavior prior to v3.6.0. <br/>
  [@benjamn](https://github.com/benjamn) in [#9734](https://github.com/apollographql/apollo-client/pull/9734)

- Fix bug where `onCompleted()` and `onError()` are stale for `useMutation()`. <br/>
  [@charle692](https://github.com/charle692) in [#9740](https://github.com/apollographql/apollo-client/pull/9740)

- Limit scope of `DeepMerger` object reuse, and avoid using `Object.isFrozen`, which can introduce differences between development and production if objects that were frozen using `Object.freeze` in development are left unfrozen in production. <br/>
  [@benjamn](https://github.com/benjamn) in [#9742](https://github.com/apollographql/apollo-client/pull/9742)

- Properly merge `variables` from original `useLazyQuery(query, { variables })` with `variables` passed to execution function. <br/>
  [@benjamn](https://github.com/benjamn) in [#9758](https://github.com/apollographql/apollo-client/pull/9758)

## Apollo Client 3.6.4 (2022-05-16)

### Bug Fixes

- Guarantee `Concast` cleanup without `Observable cancelled prematurely` rejection, potentially solving long-standing issues involving that error. <br/>
  [@benjamn](https://github.com/benjamn) in [#9701](https://github.com/apollographql/apollo-client/pull/9701)

- Ensure `useSubscription` subscriptions are properly restarted after unmounting/remounting by React 18 in `<StrictMode>`. <br/>
  [@kazekyo](https://github.com/kazekyo) in [#9707](https://github.com/apollographql/apollo-client/pull/9707)

### Improvements

- Internalize `useSyncExternalStore` shim, for more control than `use-sync-external-store` provides, fixing some React Native issues. <br/>
  [@benjamn](https://github.com/benjamn) in [#9675](https://github.com/apollographql/apollo-client/pull/9675) and [#9709](https://github.com/apollographql/apollo-client/pull/9709)

- Provide `@apollo/client/**/*.cjs.native.js` versions of every `@apollo/client/**/*.cjs` bundle (including dependencies `ts-invariant` and `zen-observable-ts`) to help React Native's Metro bundler automatically resolve CommonJS entry point modules. **These changes should render unnecessary [the advice we gave in the v3.5.4 section below about `metro.config.js`](#apollo-client-354-2021-11-19).** <br/>
  [@benjamn](https://github.com/benjamn) in [#9716](https://github.com/apollographql/apollo-client/pull/9716)

- Handle falsy `incoming` data more gracefully in `offetLimitPagination().merge` function. <br/>
  [@shobhitsharma](https://github.com/shobhitsharma) in [#9705](https://github.com/apollographql/apollo-client/pull/9705)

## Apollo Client 3.6.3 (2022-05-05, only tagged `next` on npm)

### Bug Fixes

- Simplify `useQuery(query, { defaultOptions })` default options processing in order to fix bug where `skip: true` queries failed to execute upon switching to `skip: false`. <br/>
  [@benjamn](https://github.com/benjamn) in [#9665](https://github.com/apollographql/apollo-client/pull/9665)

- Add tests of skipping/unskipping and `useLazyQuery` with `defaultOptions`, and fix a bug causing duplicate requests. <br/>
  [@benjamn](https://github.com/benjamn) in [#9666](https://github.com/apollographql/apollo-client/pull/9666)

- Update `ts-invariant` to version 0.10.2 to fix source map warnings. <br/>
  [@benjamn](https://github.com/benjamn) in [#9672](https://github.com/apollographql/apollo-client/pull/9672)

- Test that `useQuery` queries with `skip: true` do not stall server-side rendering. <br/>
  [@nathanmarks](https://github.com/nathanmarks) and [@benjamn](https://github.com/benjamn) in [#9677](https://github.com/apollographql/apollo-client/pull/9677)

- Prevent `useLazyQuery` from making duplicate requests when its execution function is first called, and stop rejecting the `Promise` it returns when `result.error` is defined. <br/>
  [@benjamn](https://github.com/benjamn) in [#9684](https://github.com/apollographql/apollo-client/pull/9684)

- Fix issue with `useQuery` returning `loading: true` state during server-side rendering with `skip: true`. <br/>
  [@nathanmarks](https://github.com/nathanmarks) in [#9679](https://github.com/apollographql/apollo-client/pull/9679)

## Apollo Client 3.6.2 (2022-05-02)

### Bug Fixes

- Pass `getServerSnapshot` function to `useSyncExternalStore` in addition to `getSnapshot`, though the two functions behave identically. This change should fix/unbreak React 18 server rendering. <br/>
  [@hungphongbk](https://github.com/hungphongbk) in [#9652](https://github.com/apollographql/apollo-client/pull/9652)

### Improvements

- Consider `networkError.result.errors` in addition to `result.errors` in `PersistedQueryLink`. <br/>
  [@redaid113](https://github.com/redaid113) and [@benjamn](https://github.com/benjamn) in [#9410](https://github.com/apollographql/apollo-client/pull/9410)

## Apollo Client 3.6.1 (2022-04-28)

### Bug Fixes

- Remove recently-added, internal `fetchBlockingPromise` option from the `WatchQueryOptions` interface, due to regressions. <br/>
  [@benjamn](https://github.com/benjamn) in [#9504](https://github.com/apollographql/apollo-client/pull/9504)

## Apollo Client 3.6.0 (2022-04-26)

### Potentially disruptive changes

- Calling `fetchMore` for queries using the `cache-and-network` or `network-only` fetch policies will no longer trigger additional network requests when cache results are complete. Instead, those complete cache results will be delivered as if using the `cache-first` fetch policy. <br/>
  [@benjamn](https://github.com/benjamn) in [#9504](https://github.com/apollographql/apollo-client/pull/9504)

- Reimplement `useQuery` and `useLazyQuery` to use the [proposed `useSyncExternalStore` API](https://github.com/reactwg/react-18/discussions/86) from React 18. <br/>
  [@brainkim](https://github.com/brainkim) and [@benjamn](https://github.com/benjamn) in [#8785](https://github.com/apollographql/apollo-client/pull/8785) and [#9596](https://github.com/apollographql/apollo-client/pull/9596)

- Fixed bug where the `useLazyQuery` execution function would always use the `refetch` method of `ObservableQuery`, instead of properly reapplying the current `fetchPolicy` using the `reobserve` method. <br/>
  [@benjamn](https://github.com/benjamn) in [#9564](https://github.com/apollographql/apollo-client/pull/9564)

  > Since this `reobserve` method is useful and used internally, we have now exposed it as `use[Lazy]Query(...).reobserve` (which optionally takes a `Partial<WatchQueryOptions>` of new options), to supplement the existing `refetch` method. Note that `reobserve` permanently updates the `variables` and other options of the `ObservableQuery`, unlike `refetch({ ...variables })`, which does not save those `variables`.

- The internal use of `options.fetchBlockingPromise` by `useQuery` and `useLazyQuery` may slightly delay the delivery of network results, compared to previous versions of Apollo Client. Since network results are already delivered asynchronously, these timing differences should not be disruptive in most cases. Nevertheless, please open an issue if the timing differences are a problem for you (and you have no easy workaround). <br/>
  [@benjamn](https://github.com/benjamn) in [#9599](https://github.com/apollographql/apollo-client/pull/9599)

### React 18

In both its `peerDependencies` and its internal implementation, Apollo Client v3.6 should no longer prevent you from updating to React 18 in your applications.

Internally, we have refactored `useQuery` and `useLazyQuery` to be implemented in terms of React's new (shimmable) `useSyncExternalStore` hook, demonstrating Apollo Client can serve as an external store with a referentially stable, synchronous API, as needed by React.

As part of this refactoring, we also improved the behavior of `useQuery` and `useLazyQuery` when used in `<React.StrictMode>`, which [double-renders components in development](https://github.com/reactwg/react-18/discussions/96). While this double-rendering always results in calling `useQuery` twice, forcing Apollo Client to create and then discard an unnecessary `ObservableQuery` object, we now have multiple defenses in place against executing any network queries for the unused `ObservableQuery` objects.

In upcoming v3.6.x and v3.7 (beta) releases, we will be completely overhauling our server-side rendering utilities (`getDataFromTree` et al.), and introducing suspenseful versions of our hooks, to take full advantage of the new patterns React 18+ enables for data management libraries like Apollo Client.

### Improvements

- Allow `BatchLink` to cancel queued and in-flight operations. <br/>
  [@PowerKiKi](https://github.com/PowerKiKi) and [@benjamn](https://github.com/benjamn) in [#9248](https://github.com/apollographql/apollo-client/pull/9248)

- Add `GraphQLWsLink` in `@apollo/client/link/subscriptions`. This link is similar to the existing `WebSocketLink` in `@apollo/client/link/ws`, but uses the newer [`graphql-ws`](https://www.npmjs.com/package/graphql-ws) package and protocol instead of the older `subscriptions-transport-ws` implementation. This functionality was technically first released in `@apollo/client@3.5.10`, but semantically belongs in the 3.6.0 minor version.
  [@glasser](https://github.com/glasser) in [#9369](https://github.com/apollographql/apollo-client/pull/9369)

- Allow passing `defaultOptions` to `useQuery` to avoid clobbering/resetting existing options when `useQuery` is called repeatedly. <br/>
  [@benjamn](https://github.com/benjamn) in [#9563](https://github.com/apollographql/apollo-client/pull/9563), superseding [#9223](https://github.com/apollographql/apollo-client/pull/9223)

- Provide additional context to `nextFetchPolicy` functions to assist with `fetchPolicy` transitions. More details can be found in the [`nextFetchPolicy` documentation](https://www.apollographql.com/docs/react/data/queries/#nextfetchpolicy). <br/>
  [@benjamn](https://github.com/benjamn) in [#9222](https://github.com/apollographql/apollo-client/pull/9222)

- Remove nagging deprecation warning about passing an `options.updateQuery` function to `fetchMore`. <br/>
  [@benjamn](https://github.com/benjamn) in [#9504](https://github.com/apollographql/apollo-client/pull/9504)

- Let `addTypenameToDocument` take any `ASTNode` (including `DocumentNode`, as before). <br/>
  [@benjamn](https://github.com/benjamn) in [#9595](https://github.com/apollographql/apollo-client/pull/9595)

- Set `useMutation` internal `isMounted` variable to `true` again when component remounted. <br/>
  [@devpeerapong](https://github.com/devpeerapong) in [#9561](https://github.com/apollographql/apollo-client/pull/9561)

## Apollo Client 3.5.10 (2022-02-24)

### Improvements

- Add `GraphQLWsLink` in `@apollo/client/link/subscriptions`. This link is similar to the existing `WebSocketLink` in `@apollo/client/link/ws`, but uses the newer [`graphql-ws`](https://www.npmjs.com/package/graphql-ws) package and protocol instead of the older `subscriptions-transport-ws` implementation. <br/>
  [@glasser](https://github.com/glasser) in [#9369](https://github.com/apollographql/apollo-client/pull/9369)

  > Note from [@benjamn](https://github.com/benjamn): since `GraphQLWsLink` is new functionality, we would normally wait for the next minor version (v3.6), but we were asked to expedite this release. These changes are strictly additive/opt-in/backwards-compatible, so shipping them in a patch release (3.5.10) seems safe, if unusual.

## Apollo Client 3.5.9 (2022-02-15)

### Improvements

- Interpret `keyFields: [...]` and `keyArgs: [...]` configurations in `InMemoryCache` type/field policies as `ReadonlyArray`s, since they are never mutated internally. <br/>
  [@julienfouilhe](https://github.com/julienfouilhe) in [#9339](https://github.com/apollographql/apollo-client/pull/9339)

- Avoid declaring a global type for the `__DEV__` constant, to avoid conflict with other such global declarations. <br/>
  [@benjamn](https://github.com/benjamn) in [#9386](https://github.com/apollographql/apollo-client/pull/9386)

### Bug Fixes

- Fix `useSubscription` executing `skip`ped subscription when input changes. <br/>
  [@levrik](https://github.com/levrik) in [#9299](https://github.com/apollographql/apollo-client/pull/9299)

- Fix partial data appearing in `useQuery().data` when `notifyOnNetworkStatusChange: true`. <br/>
  [@brainkim](https://github.com/brainkim) in [#9367](https://github.com/apollographql/apollo-client/pull/9367)

- Prevent `Promise`s returned by `useLazyQuery` execute functions from causing unhandled `Promise` rejection errors if uncaught. <br/>
  [@brainkim](https://github.com/brainkim) in [#9380](https://github.com/apollographql/apollo-client/pull/9380)

## Apollo Client 3.5.8 (2022-01-24)

### Bug Fixes

- Fix the type of the `called` property returned by `useQuery()` and `useLazyQuery()`. <br/>
  [@sztadii](https://github.com/sztadii) in [#9304](https://github.com/apollographql/apollo-client/pull/9304)

### Bug Fixes (by [@brainkim](https://github.com/brainkim) in [#9328](https://github.com/apollographql/apollo-client/pull/9328))

- Fix `refetch()` not being called when `skip` is true.
- Fix the promise returned from the `useLazyQuery()` execution function having stale variables.
- Fix the promise returned from the `useLazyQuery()` execution function not rejecting when a query errors.

## Apollo Client 3.5.7 (2022-01-10)

### Bug Fixes

- Fix regression that prevented calling `onError` or `onCompleted` in some cases when using `useQuery`. <br/>
  [@mmahalwy](https://github.com/mmahalwy) in [#9226](https://github.com/apollographql/apollo-client/pull/9226)

- Make `useQuery` respect `defaultOptions.watchQuery.fetchPolicy`. <br/>
  [@yasharzolmajdi](https://github.com/yasharzolmajdi) in [#9210](https://github.com/apollographql/apollo-client/pull/9210)

## Apollo Client 3.5.6 (2021-12-07)

### Bug Fixes (by [@brainkim](https://github.com/brainkim) in [#9144](https://github.com/apollographql/apollo-client/pull/9144))

- Restores old behavior where the callback passed to `useMutation()` is constant.
- Fix `useMutation()` callbacks having stale closures.
- Fix `useQuery()` variables being out of date.

## Apollo Client 3.5.5 (2021-11-23)

### Bug Fixes

- Remove `printer: Printer` positional parameter from publicly-exported `selectHttpOptionsAndBody` function, whose addition in [#8699](https://github.com/apollographql/apollo-client/pull/8699) was a breaking change (starting in Apollo Client 3.5.0) for direct consumers of `selectHttpOptionsAndBody`. <br/>
  [@benjamn](https://github.com/benjamn) in [#9103](https://github.com/apollographql/apollo-client/pull/9103)

## Apollo Client 3.5.4 (2021-11-19)

### Notices

> ⚠️ The following advice about `metro.config.js` should no longer be necessary, as of Apollo Client v3.6.4.

- [Relevant if you use Apollo Client with React Native] Since Apollo Client v3.5.0, CommonJS bundles provided by `@apollo/client` use a `.cjs` file extension rather than `.cjs.js`, so Node.js won't interpret them as ECMAScript modules. While this change should be an implementation detail, it may cause problems for the [Metro bundler](https://facebook.github.io/metro/) used by React Native, whose [`resolver.sourceExts`](https://facebook.github.io/metro/docs/configuration#sourceexts) configuration does not include the `cjs` extension by default.

  As a workaround until [this issue](https://github.com/facebook/metro/issues/535) is resolved, you can configure Metro to understand the `.cjs` file extension by creating a `metro.config.js` file in the root of your React Native project:

  ```js
  // NOTE: No longer necessary in @apollo/client@3.6.4!
  const { getDefaultConfig } = require("metro-config");
  const { resolver: defaultResolver } = getDefaultConfig.getDefaultValues();
  exports.resolver = {
    ...defaultResolver,
    sourceExts: [...defaultResolver.sourceExts, "cjs"],
  };
  ```

### Improvements

- Restore the ability to pass `onError()` and `onCompleted()` to the mutation execution function. <br/> [@brainkim](https://github.com/brainkim) in [#9076](https://github.com/apollographql/apollo-client/pull/9076)

- Work around webpack 5 errors of the form
  ```
  The request 'ts-invariant/process' failed to resolve only because it was resolved as fully specified
  ```
  by ensuring `import ... from 'ts-invariant/process'` is internally written to `import ... from 'ts-invariant/process/index.js'`. <br/>
  [@benjamn](https://github.com/benjamn) in [#9083](https://github.com/apollographql/apollo-client/pull/9083)

## Apollo Client 3.5.3 (2021-11-17)

- Avoid rewriting non-relative imported module specifiers in `config/rewriteModuleIds.ts` script, thereby allowing bundlers to resolve those imports as they see fit. <br/>
  [@benjamn](https://github.com/benjamn) in [#9073](https://github.com/apollographql/apollo-client/pull/9073)

- Ensure only current file is matched when running VSCode debugger. <br/>
  [@eps1lon](https://github.com/eps1lon) in [#9050](https://github.com/apollographql/apollo-client/pull/9050)

## Apollo Client 3.5.2 (2021-11-10)

- Fix `useMutation` execute function returning non-identical execution functions when passing similar options. <br/>
  [@brainkim](https://github.com/brainkim) in [#9037](https://github.com/apollographql/apollo-client/pull/9037)

## Apollo Client 3.5.1 (2021-11-09)

- Remove npm from dependencies, and avoid referencing graphql-js enum value. <br/>
  [@brainkim](https://github.com/brainkim) in [#9030](https://github.com/apollographql/apollo-client/pull/9030)

## Apollo Client 3.5.0 (2021-11-08)

### Improvements

- Add `updateQuery` and `updateFragment` methods to `ApolloCache`, simplifying common `readQuery`/`writeQuery` cache update patterns. <br/>
  [@wassim-k](https://github.com/wassim-k) in [#8382](https://github.com/apollographql/apollo-client/pull/8382)

- Field directives and their arguments can now be included along with field argument names when using [field policy `keyArgs: [...]` notation](https://www.apollographql.com/docs/react/pagination/key-args/). For example, if you have a `Query.feed` field that takes an argument called `type` and uses a `@connection(key:...)` directive to keep `feed` data from different queries separate within the cache, you might configure both using the following `InMemoryCache` field policy:

  ```ts
  new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          feed: {
            keyArgs: ["type", "@connection", ["key"]],
          },
        },
      },
    },
  });
  ```

  [@benjamn](https://github.com/benjamn) in [#8678](https://github.com/apollographql/apollo-client/pull/8678)

- Report single `MissingFieldError` instead of a potentially very large `MissingFieldError[]` array for incomplete cache reads, improving performance and memory usage. <br/>
  [@benjamn](https://github.com/benjamn) in [#8734](https://github.com/apollographql/apollo-client/pull/8734)

- When writing results into `InMemoryCache`, each written object is now identified using `policies.identify` _after_ traversing the fields of the object (rather than before), simplifying identification and reducing duplicate work. If you have custom `keyFields` functions, they still receive the raw result object as their first parameter, but the `KeyFieldsContext` parameter now provides `context.storeObject` (the `StoreObject` just processed by `processSelectionSet`) and `context.readField` (a helper function for reading fields from `context.storeObject` and any `Reference`s it might contain, similar to `readField` for `read`, `merge`, and `cache.modify` functions). <br/>
  [@benjamn](https://github.com/benjamn) in [#8996](https://github.com/apollographql/apollo-client/pull/8996)

- Ensure `cache.identify` never throws when primary key fields are missing, and include the source object in the error message when `keyFields` processing fails. <br/>
  [@benjamn](https://github.com/benjamn) in [#8679](https://github.com/apollographql/apollo-client/pull/8679)

- The `HttpLink` constructor now accepts an optional `print` function that can be used to customize how GraphQL `DocumentNode` objects are transformed back into strings before they are sent over the network. <br/>
  [@sarahgp](https://github.com/sarahgp) in [#8699](https://github.com/apollographql/apollo-client/pull/8699)

- Make `@apollo/client/testing` a fully-fledged, independent entry point, instead of re-exporting `@apollo/client/utilities/testing` (which was never an entry point and no longer exists). <br/>
  [@benjamn](https://github.com/benjamn) in [#8769](https://github.com/apollographql/apollo-client/pull/8769)

- A new nested entry point called `@apollo/client/testing/core` has been created. Importing from this entry point instead of `@apollo/client/testing` excludes any React-related dependencies. <br/>
  [@wassim-k](https://github.com/wassim-k) in [#8687](https://github.com/apollographql/apollo-client/pull/8687)

- Make `cache.batch` return the result of calling the `options.update` function. <br/>
  [@benjamn](https://github.com/benjamn) in [#8696](https://github.com/apollographql/apollo-client/pull/8696)

- The `NetworkError` and `ErrorResponse` types have been changed to align more closely. <br/>
  [@korywka](https://github.com/korywka) in [#8424](https://github.com/apollographql/apollo-client/pull/8424)

- Include `graphql@16` in peer deps. <br/>
  [@brainkim](https://github.com/brainkim) in [#8997](https://github.com/apollographql/apollo-client/pull/8997)

- Update `zen-observable-ts` to eliminate transitive dependency on `@types/zen-observable`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8695](https://github.com/apollographql/apollo-client/pull/8695)

### React Refactoring

#### Improvements (due to [@brainkim](https://github.com/brainkim) in [#8875](https://github.com/apollographql/apollo-client/pull/8875)):

- The `useLazyQuery` function now returns a promise with the result.
- The `useMutation` result now exposes a method which can be reset.

#### Bug Fixes (due to [@brainkim](https://github.com/brainkim) in [#8596](https://github.com/apollographql/apollo-client/pull/8596)):

- The `useQuery` and `useLazyQuery` hooks will now have `ObservableQuery` methods defined consistently.
- Calling `useLazyQuery` methods like `startPolling` will start the query.
- Calling the `useLazyQuery` execution function will now behave more like `refetch`. `previousData` will be preserved.
- `standby` fetchPolicies will now act like `skip: true` more consistently.
- Calling `refetch` on a skipped query will have no effect (issue [#8270](https://github.com/apollographql/apollo-client/issues/8270)).
- Prevent `onError` and `onCompleted` functions from firing continuously, and improving their polling behavior.

## Apollo Client 3.4.17 (2021-11-08)

### Improvements

- Allow `TOptions extends FieldFunctionOptions` to be passed as final (optional) type parameter of `FieldPolicy` type. <br/>
  [@VictorGaiva](https://github.com/VictorGaiva) in [#9000](https://github.com/apollographql/apollo-client/pull/9000)

## Apollo Client 3.4.16

### Improvements

- Prevent webpack from misresolving the `graphql` package as the local `@apollo/client/utilities/globals/graphql.js` module when `module.exports.resolve.preferRelative` is enabled in `webpack.config.js`.

  > Note: if you encounter strange module resolution errors like `export 'isType' (imported as 'isType') was not found in 'graphql' (possible exports: removeTemporaryGlobals)` please try removing `preferRelative: true` from your `webpack.config.js` file, or find a way to disable that resolution behavior for packages within `node_modules`.

  [@benjamn](https://github.com/benjamn) in [#8862](https://github.com/apollographql/apollo-client/pull/8862)

- Avoid importing `isType` from the `graphql` package internally, to prevent bundlers from including as much as 3.4kB of unnecessary code. <br/>
  [@benjamn](https://github.com/benjamn) in [#8891](https://github.com/apollographql/apollo-client/pull/8891)

- Make `client.resetStore` and `client.clearStore` pass appropriate `discardWatches` option to `cache.reset`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8873](https://github.com/apollographql/apollo-client/pull/8873)

## Apollo Client 3.4.15

### Bug Fixes

- Require calling `cache.reset({ discardWatches: true })` to make `cache.reset` discard `cache.watches`, restoring behavior broken in v3.4.14 by [#8826](https://github.com/apollographql/apollo-client/pull/8826). <br/>
  [@benjamn](https://github.com/benjamn) in [#8852](https://github.com/apollographql/apollo-client/pull/8852)

## Apollo Client 3.4.14

### Bug Fixes

- Disable `InMemoryCache` [result object canonization](https://github.com/apollographql/apollo-client/pull/7439) by default, to prevent unexpected memory growth and/or reuse of object references, with multiple ways to reenable it (per-cache, per-query, or a mixture of both). <br/>
  [@benjamn](https://github.com/benjamn) in [#8822](https://github.com/apollographql/apollo-client/pull/8822)

- Clear `InMemoryCache` `watches` set when `cache.reset()` called. <br/>
  [@benjamn](https://github.com/benjamn) in [#8826](https://github.com/apollographql/apollo-client/pull/8826)

- Stop excluding observerless queries from `refetchQueries: [...]` selection. <br/>
  [@benjamn](https://github.com/benjamn) in [#8825](https://github.com/apollographql/apollo-client/pull/8825)

- Prevent optimistic cache evictions from evicting non-optimistic data. <br/>
  [@benjamn](https://github.com/benjamn) in [#8829](https://github.com/apollographql/apollo-client/pull/8829)

- Ensure `cache.broadcastWatch` passes all relevant `WatchOptions` to `cache.diff` as `DiffOptions`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8832](https://github.com/apollographql/apollo-client/pull/8832)

## Apollo Client 3.4.13

### Bug Fixes

- Fix `componentDidUpate` typo in `withSubscription` higher-order component. <br/>
  [@YarBez](https://github.com/YarBez) in [#7506](https://github.com/apollographql/apollo-client/pull/7506)

- Fix internal `canUseSymbol` import within `@apollo/client/utilities` to avoid breaking bundlers/builds. <br/>
  [@benjamn](https://github.com/benjamn) in [#8817](https://github.com/apollographql/apollo-client/pull/8817)

- Tolerate unfreezable objects like `Uint8Array` and `Buffer` in `maybeDeepFreeze`. <br/>
  [@geekuillaume](https://github.com/geekuillaume) and [@benjamn](https://github.com/benjamn) in [#8813](https://github.com/apollographql/apollo-client/pull/8813)

## Apollo Client 3.4.12

### Bug Fixes

- Improve handling of falsy `existing` and/or `incoming` parameters in `relayStylePagination` field policy helper function. <br/>
  [@bubba](https://github.com/bubba) and [@benjamn](https://github.com/benjamn) in [#8733](https://github.com/apollographql/apollo-client/pull/8733)

- Associate Apollo context with `React.createContext` (instead of using a local `WeakMap`) again, so multiple copies of `@apollo/client` (uncommon) can share the same context. <br/>
  [@benjamn](https://github.com/benjamn) in [#8798](https://github.com/apollographql/apollo-client/pull/8798)

## Apollo Client 3.4.11

### Bug Fixes

- Fix [Vite](https://vitejs.dev) tree-shaking by calling the `checkDEV()` function (at least once) in the module that exports it, `@apollo/client/utilities/globals/index.ts`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8767](https://github.com/apollographql/apollo-client/pull/8767)

### Improvements

- Export `PersistedQueryLink` namespace from `@apollo/client/link/persisted-queries`. <br/>
  [@vedrani](https://github.com/vedrani) in [#8761](https://github.com/apollographql/apollo-client/pull/8761)

### Documentation

- Upgrade docs theme for new Algolia-powered search experience. <br/>
  [@trevorblades](https://github.com/trevorblades) in [#8768](https://github.com/apollographql/apollo-client/pull/8768)

## Apollo Client 3.4.10

### Improvements

- Warn when calling `refetch({ variables })` instead of `refetch(variables)`, except for queries that declare a variable named `$variables` (uncommon). <br/>
  [@benjamn](https://github.com/benjamn) in [#8702](https://github.com/apollographql/apollo-client/pull/8702)

### Bug Fixes

- Fix `ObservableQuery.getCurrentResult()` returning cached `data` with certain fetch policies. <br/>
  [@brainkim](https://github.com/brainkim) in [#8718](https://github.com/apollographql/apollo-client/pull/8718)

- Prevent `ssrMode`/`ssrForceFetchDelay` from causing queries to hang. <br/>
  [@brainkim](https://github.com/brainkim) in [#8709](https://github.com/apollographql/apollo-client/pull/8709)

- Import `@apollo/client/utilities/globals` internally wherever `__DEV__` is used, not just in `@apollo/client/**/index.js` entry points. <br/>
  [@benjamn](https://github.com/benjamn) in [#8720](https://github.com/apollographql/apollo-client/pull/8720)

## Apollo Client 3.4.9

### Bug Fixes

- Fix unhandled `Promise` rejection warnings/errors whose message is `Observable cancelled prematurely`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8676](https://github.com/apollographql/apollo-client/pull/8676)

- Enforce that `__DEV__` is polyfilled by every `@apollo/client/*` entry point that uses it. This build step considers not only explicit `__DEV__` usage but also `__DEV__` references injected near `invariant(...)` and `new InvariantError(...)` expressions. <br/>
  [@benjamn](https://github.com/benjamn) in [#8689](https://github.com/apollographql/apollo-client/pull/8689)

## Apollo Client 3.4.8

### Bug Fixes

- Fix error thrown by nested `keyFields: ["a", ["b", "c"], "d"]` type policies when writing results into the cache where any of the key fields (`.a`, `.a.b`, `.a.c`, or `.d`) have been renamed by query field alias syntax. <br/>
  [@benjamn](https://github.com/benjamn) in [#8643](https://github.com/apollographql/apollo-client/pull/8643)

- Fix regression from PR [#8422](https://github.com/apollographql/apollo-client/pull/8422) (first released in `@apollo/client@3.4.0-rc.15`) that caused `result.data` to be set to undefined in some cases after `ObservableQuery#getCurrentResult` reads an incomplete result from the cache. <br/>
  [@benjamn](https://github.com/benjamn) in [#8642](https://github.com/apollographql/apollo-client/pull/8642)

## Apollo Client 3.4.7

### Bug Fixes

- Fix accidental reuse of recycled `MergeTree` objects in `StoreWriter` class used by `InMemoryCache`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8618](https://github.com/apollographql/apollo-client/pull/8618)

## Apollo Client 3.4.6

### Improvements

- Reevaluate `window.fetch` each time `HttpLink` uses it, if not configured using `options.fetch`. This change enables a variety of strategies for instrumenting `window.fetch`, without requiring those strategies to run before `@apollo/client/link/http` is first imported. <br/>
  [@benjamn](https://github.com/benjamn) in [#8603](https://github.com/apollographql/apollo-client/pull/8603)

- Clarify mutation `fetchPolicy` options (`"network-only"` or `"no-cache"`) using [`MutationFetchPolicy`](https://github.com/apollographql/apollo-client/blob/fa52875341ab33f3e8192ded90af5e2c208e0f75/src/core/watchQueryOptions.ts#L33-L37) union type. <br/>
  [@benjamn](https://github.com/benjamn) in [#8602](https://github.com/apollographql/apollo-client/pull/8602)

### Bug Fixes

- Restore full `@apollo/client/apollo-client.cjs.js` CommonJS bundle for older bundlers.

  > Note that Node.js and CommonJS bundlers typically use the bundles specified by `"main"` fields in our generated `package.json` files, which are all independent and non-overlapping CommonJS modules. However, `apollo-client.cjs.js` is just one big bundle, so mixing imports of `apollo-client.cjs.js` with the other CommonJS bundles is discouraged, as it could trigger the [dual package hazard](https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages). In other words, please don't start using `apollo-client.cjs.js` if you're not already. <br/>

  [@benjamn](https://github.com/benjamn) in [#8592](https://github.com/apollographql/apollo-client/pull/8592)

- Log `MissingFieldError`s in `ObservableQuery#getCurrentResult` using `invariant.debug`, rather than reporting them via `result.error`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8604](https://github.com/apollographql/apollo-client/pull/8604)

## Apollo Client 3.4.5

### Bug Fixes

- Fix double registration bug for mutation `refetchQueries` specified using legacy one-time `refetchQueries: [{ query, variables }]` style. Though the bug is fixed, we recommend using `refetchQueries: [query]` instead (when possible) to refetch an existing query using its `DocumentNode`, rather than creating, executing, and then deleting a new query, as the legacy `{ query, variables }` style unfortunately does. <br/>
  [@benjamn](https://github.com/benjamn) in [#8586](https://github.com/apollographql/apollo-client/pull/8586)

- Fix `useQuery`/`useLazyQuery` stalling when clients or queries change. <br/>
  [@brainkim](https://github.com/brainkim) in [#8589](https://github.com/apollographql/apollo-client/pull/8589)

## Apollo Client 3.4.4

### Bug Fixes

- Revert accidental addition of `engines.npm` section to published version of `@apollo/client/package.json`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8578](https://github.com/apollographql/apollo-client/pull/8578)

## Apollo Client 3.4.3

### Bug Fixes

- Fix `{ ssr: false }` causing queries to hang on the client. <br/>
  [@brainkim](https://github.com/brainkim) in [#8574](https://github.com/apollographql/apollo-client/pull/8574)

## Apollo Client 3.4.2

### Bug Fixes

- Use more default type parameters for mutation-related types in `react/types/types.ts`, to provide smoother backwards compatibility for code using those types explicitly. <br/>
  [@benjamn](https://github.com/benjamn) in [#8573](https://github.com/apollographql/apollo-client/pull/8573)

## Apollo Client 3.4.1

### Bug Fixes

- Initialize `stringifyCanon` lazily, when `canonicalStringify` is first called, fixing `Uncaught ReferenceError: __DEV__ is not defined` errors due to usage of `__DEV__` before declaration. <br/>
  [@benjamn](https://github.com/benjamn) in [#8557](https://github.com/apollographql/apollo-client/pull/8557)

## Apollo Client 3.4.0

### New documentation

- [**Refetching queries**](https://www.apollographql.com/docs/react/data/refetching/) with `client.refetchQueries`. <br/>
  [@StephenBarlow](https://github.com/StephenBarlow) and [@benjamn](https://github.com/benjamn) in [#8265](https://github.com/apollographql/apollo-client/pull/8265)

### Improvements

- `InMemoryCache` now _guarantees_ that any two result objects returned by the cache (from `readQuery`, `readFragment`, etc.) will be referentially equal (`===`) if they are deeply equal. Previously, `===` equality was often achievable for results for the same query, on a best-effort basis. Now, equivalent result objects will be automatically shared among the result trees of completely different queries. This guarantee is important for taking full advantage of optimistic updates that correctly guess the final data, and for "pure" UI components that can skip re-rendering when their input data are unchanged. <br/>
  [@benjamn](https://github.com/benjamn) in [#7439](https://github.com/apollographql/apollo-client/pull/7439)

- Mutations now accept an optional callback function called `onQueryUpdated`, which will be passed the `ObservableQuery` and `Cache.DiffResult` objects for any queries invalidated by cache writes performed by the mutation's final `update` function. Using `onQueryUpdated`, you can override the default `FetchPolicy` of the query, by (for example) calling `ObservableQuery` methods like `refetch` to force a network request. This automatic detection of invalidated queries provides an alternative to manually enumerating queries using the `refetchQueries` mutation option. Also, if you return a `Promise` from `onQueryUpdated`, the mutation will automatically await that `Promise`, rendering the `awaitRefetchQueries` option unnecessary. <br/>
  [@benjamn](https://github.com/benjamn) in [#7827](https://github.com/apollographql/apollo-client/pull/7827)

- Support `client.refetchQueries` as an imperative way to refetch queries, without having to pass `options.refetchQueries` to `client.mutate`. <br/>
  [@dannycochran](https://github.com/dannycochran) in [#7431](https://github.com/apollographql/apollo-client/pull/7431)

- Improve standalone `client.refetchQueries` method to support automatic detection of queries needing to be refetched. <br/>
  [@benjamn](https://github.com/benjamn) in [#8000](https://github.com/apollographql/apollo-client/pull/8000)

- Fix remaining barriers to loading [`@apollo/client/core`](https://cdn.jsdelivr.net/npm/@apollo/client@3.4.0/core/+esm) as native ECMAScript modules from a CDN like [esm.run](https://www.jsdelivr.com/esm). Importing `@apollo/client` from a CDN will become possible once we move all React-related dependencies into `@apollo/client/react` in Apollo Client 4. <br/>
  [@benjamn](https://github.com/benjamn) in [#8266](https://github.com/apollographql/apollo-client/issues/8266)

- `InMemoryCache` supports a new method called `batch`, which is similar to `performTransaction` but takes named options rather than positional parameters. One of these named options is an `onDirty(watch, diff)` callback, which can be used to determine which watched queries were invalidated by the `batch` operation. <br/>
  [@benjamn](https://github.com/benjamn) in [#7819](https://github.com/apollographql/apollo-client/pull/7819)

- Allow `merge: true` field policy to merge `Reference` objects with non-normalized objects, and vice-versa. <br/>
  [@benjamn](https://github.com/benjamn) in [#7778](https://github.com/apollographql/apollo-client/pull/7778)

- Allow identical subscriptions to be deduplicated by default, like queries. <br/>
  [@jkossis](https://github.com/jkossis) in [#6910](https://github.com/apollographql/apollo-client/pull/6910)

- Always use `POST` request when falling back to sending full query with `@apollo/client/link/persisted-queries`. <br/>
  [@rieset](https://github.com/rieset) in [#7456](https://github.com/apollographql/apollo-client/pull/7456)

- The `FetchMoreQueryOptions` type now takes two instead of three type parameters (`<TVariables, TData>`), thanks to using `Partial<TVariables>` instead of `K extends typeof TVariables` and `Pick<TVariables, K>`. <br/>
  [@ArnaudBarre](https://github.com/ArnaudBarre) in [#7476](https://github.com/apollographql/apollo-client/pull/7476)

- Pass `variables` and `context` to a mutation's `update` function. **Note:** The type of the `update` function is now named `MutationUpdaterFunction` rather than `MutationUpdaterFn`, since the older type was [broken beyond repair](https://github.com/apollographql/apollo-client/issues/8506#issuecomment-881706613). If you are using `MutationUpdaterFn` in your own code, please use `MutationUpdaterFunction` instead. <br/>
  [@jcreighton](https://github.com/jcreighton) in [#7902](https://github.com/apollographql/apollo-client/pull/7902)

- A `resultCacheMaxSize` option may be passed to the `InMemoryCache` constructor to limit the number of result objects that will be retained in memory (to speed up repeated reads), and calling `cache.reset()` now releases all such memory. <br/>
  [@SofianHn](https://github.com/SofianHn) in [#8107](https://github.com/apollographql/apollo-client/pull/8107)

- Fully remove result cache entries from LRU dependency system when the corresponding entities are removed from `InMemoryCache` by eviction, or by any other means. <br/>
  [@sofianhn](https://github.com/sofianhn) and [@benjamn](https://github.com/benjamn) in [#8147](https://github.com/apollographql/apollo-client/pull/8147)

- Expose missing field errors in results. <br/>
  [@brainkim](github.com/brainkim) in [#8262](https://github.com/apollographql/apollo-client/pull/8262)

- Add expected/received `variables` to `No more mocked responses...` error messages generated by `MockLink`. <br/>
  [@markneub](github.com/markneub) in [#8340](https://github.com/apollographql/apollo-client/pull/8340)

- The `InMemoryCache` version of the `cache.gc` method now supports additional options for removing non-essential (recomputable) result caching data. <br/>
  [@benjamn](https://github.com/benjamn) in [#8421](https://github.com/apollographql/apollo-client/pull/8421)

- Suppress noisy `Missing cache result fields...` warnings by default unless `setLogVerbosity("debug")` called. <br/>
  [@benjamn](https://github.com/benjamn) in [#8489](https://github.com/apollographql/apollo-client/pull/8489)

- Improve interaction between React hooks and React Fast Refresh in development. <br/>
  [@andreialecu](https://github.com/andreialecu) in [#7952](https://github.com/apollographql/apollo-client/pull/7952)

### Potentially disruptive changes

- To avoid retaining sensitive information from mutation root field arguments, Apollo Client v3.4 automatically clears any `ROOT_MUTATION` fields from the cache after each mutation finishes. If you need this information to remain in the cache, you can prevent the removal by passing the `keepRootFields: true` option to `client.mutate`. `ROOT_MUTATION` result data are also passed to the mutation `update` function, so we recommend obtaining the results that way, rather than using `keepRootFields: true`, if possible. <br/>
  [@benjamn](https://github.com/benjamn) in [#8280](https://github.com/apollographql/apollo-client/pull/8280)

- Internally, Apollo Client now controls the execution of development-only code using the `__DEV__` global variable, rather than `process.env.NODE_ENV`. While this change should not cause any visible differences in behavior, it will increase your minified+gzip bundle size by more than 3.5kB, unless you configure your minifier to replace `__DEV__` with a `true` or `false` constant, the same way you already replace `process.env.NODE_ENV` with a string literal like `"development"` or `"production"`. For an example of configuring a Create React App project without ejecting, see this pull request for our [React Apollo reproduction template](https://github.com/apollographql/react-apollo-error-template/pull/51). <br/>
  [@benjamn](https://github.com/benjamn) in [#8347](https://github.com/apollographql/apollo-client/pull/8347)

- Internally, Apollo Client now uses namespace syntax (e.g. `import * as React from "react"`) for imports whose types are re-exported (and thus may appear in `.d.ts` files). This change should remove any need to configure `esModuleInterop` or `allowSyntheticDefaultImports` in `tsconfig.json`, but might require updating bundler configurations that specify named exports of the `react` and `prop-types` packages, to include exports like `createContext` and `createElement` ([example](https://github.com/apollographql/apollo-client/commit/16b08e1af9ba9934041298496e167aafb128c15d)). <br/>
  [@devrelm](https://github.com/devrelm) in [#7742](https://github.com/apollographql/apollo-client/pull/7742)

- Respect `no-cache` fetch policy (by not reading any `data` from the cache) for `loading: true` results triggered by `notifyOnNetworkStatusChange: true`. <br />
  [@jcreighton](https://github.com/jcreighton) in [#7761](https://github.com/apollographql/apollo-client/pull/7761)

- The TypeScript return types of the `getLastResult` and `getLastError` methods of `ObservableQuery` now correctly include the possibility of returning `undefined`. If you happen to be calling either of these methods directly, you may need to adjust how the calling code handles the methods' possibly-`undefined` results. <br/>
  [@benjamn](https://github.com/benjamn) in [#8394](https://github.com/apollographql/apollo-client/pull/8394)

- Log non-fatal `invariant.error` message when fields are missing from result objects written into `InMemoryCache`, rather than throwing an exception. While this change relaxes an exception to be merely an error message, which is usually a backwards-compatible change, the error messages are logged in more cases now than the exception was previously thrown, and those new error messages may be worth investigating to discover potential problems in your application. The errors are not displayed for `@client`-only fields, so adding `@client` is one way to handle/hide the errors for local-only fields. Another general strategy is to use a more precise query to write specific subsets of data into the cache, rather than reusing a larger query that contains fields not present in the written `data`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8416](https://github.com/apollographql/apollo-client/pull/8416)

- The [`nextFetchPolicy`](https://github.com/apollographql/apollo-client/pull/6893) option for `client.watchQuery` and `useQuery` will no longer be removed from the `options` object after it has been applied, and instead will continue to be applied any time `options.fetchPolicy` is reset to another value, until/unless the `options.nextFetchPolicy` property is removed from `options`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8465](https://github.com/apollographql/apollo-client/pull/8465)

- The `fetchMore`, `subscribeToMore`, and `updateQuery` functions returned from the `useQuery` hook may now return undefined in edge cases where the functions are called when the component is unmounted <br/> [@noghartt](https://github.com/noghartt) in [#7980](https://github.com/apollographql/apollo-client/pull/7980).

### Bug fixes

- In Apollo Client 2.x, a `refetch` operation would always replace existing data in the cache. With the introduction of field policy `merge` functions in Apollo Client 3, existing field values could be inappropriately combined with incoming field values by a custom `merge` function that does not realize a `refetch` has happened.

  To give you more control over this behavior, we have introduced an `overwrite?: boolean = false` option for `cache.writeQuery` and `cache.writeFragment`, and an option called `refetchWritePolicy?: "merge" | "overwrite"` for `client.watchQuery`, `useQuery`, and other functions that accept `WatchQueryOptions`. You can use these options to make sure any `merge` functions involved in cache writes for `refetch` operations get invoked with `undefined` as their first argument, which simulates the absence of any existing data, while still giving the `merge` function a chance to determine the internal representation of the incoming data.

  The default behaviors are `overwrite: true` and `refetchWritePolicy: "overwrite"`, which restores the Apollo Client 2.x behavior, but (if this change causes any problems for your application) you can easily recover the previous merging behavior by setting a default value for `refetchWritePolicy` in `defaultOptions.watchQuery`:

  ```ts
  new ApolloClient({
    defaultOptions: {
      watchQuery: {
        refetchWritePolicy: "merge",
      },
    },
  });
  ```

  [@benjamn](https://github.com/benjamn) in [#7810](https://github.com/apollographql/apollo-client/pull/7810)

- Make sure the `MockedResponse` `ResultFunction` type is re-exported. <br/>
  [@hwillson](https://github.com/hwillson) in [#8315](https://github.com/apollographql/apollo-client/pull/8315)

- Fix polling when used with `skip`. <br/>
  [@brainkim](https://github.com/brainkim) in [#8346](https://github.com/apollographql/apollo-client/pull/8346)

- `InMemoryCache` now coalesces `EntityStore` updates to guarantee only one `store.merge(id, fields)` call per `id` per cache write. <br/>
  [@benjamn](https://github.com/benjamn) in [#8372](https://github.com/apollographql/apollo-client/pull/8372)

- Fix polling when used with `<React.StrictMode>`. <br/>
  [@brainkim](https://github.com/brainkim) in [#8414](https://github.com/apollographql/apollo-client/pull/8414)

- Fix the React integration logging `Warning: Can't perform a React state update on an unmounted component`. <br/>
  [@wuarmin](https://github.com/wuarmin) in [#7745](https://github.com/apollographql/apollo-client/pull/7745)

- Make `ObservableQuery#getCurrentResult` always call `queryInfo.getDiff()`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8422](https://github.com/apollographql/apollo-client/pull/8422)

- Make `readField` default to reading from current object only when the `from` option/argument is actually omitted, not when `from` is passed to `readField` with an undefined value. A warning will be printed when this situation occurs. <br/>
  [@benjamn](https://github.com/benjamn) in [#8508](https://github.com/apollographql/apollo-client/pull/8508)

- The `fetchMore`, `subscribeToMore`, and `updateQuery` functions no longer throw `undefined` errors <br/> [@noghartt](https://github.com/noghartt) in [#7980](https://github.com/apollographql/apollo-client/pull/7980).

## Apollo Client 3.3.21

### Bug fixes

- Fix race condition in `@apollo/client/link/context` that could leak subscriptions if the subscription is cancelled before `operation.setContext` is called. <br/>
  [@sofianhn](https://github.com/sofianhn) in [#8399](https://github.com/apollographql/apollo-client/pull/8399)

- Prefer `existing.pageInfo.startCursor` and `endCursor` (if defined) in `read` function of `relayStylePagination` policies. <br/>
  [@benjamn](https://github.com/benjamn) in [#8438](https://github.com/apollographql/apollo-client/pull/8438)

### Improvements

- Normalize user-provided `HttpLink` headers by lower-casing their names. <br/>
  [@benjamn](https://github.com/benjamn) in [#8449](https://github.com/apollographql/apollo-client/pull/8449)

## Apollo Client 3.3.20

### Bug fixes

- Fix policy merging bug when calling `cache.policies.addTypePolicies` multiple times for the same type policy. <br/>
  [@Banou26](https://github.com/Banou26) in [#8361](https://github.com/apollographql/apollo-client/pull/8361)

## Apollo Client 3.3.19

### Bug fixes

- Use `export ... from` syntax to re-export `graphql-tag` named exports, making tree-shaking easier for some bundlers. <br/>
  [@benjamn](https://github.com/benjamn) in [#8221](https://github.com/apollographql/apollo-client/pull/8221)

### Documentation

- Replace Spectrum references with [community.apollographql.com](https://community.apollographql.com). <br/>
  [@hwillson](https://github.com/hwillson) in [#8238](https://github.com/apollographql/apollo-client/pull/8238)

## Apollo Client 3.3.18

### Bug fixes

- Add `"sideEffects": false` to all generated/published `package.json` files, to improve dead code elimination for nested entry points like `@apollo/client/cache`. <br/>
  [@benjamn](https://github.com/benjamn) in [#8213](https://github.com/apollographql/apollo-client/pull/8213)

## Apollo Client 3.3.17

### Bug fixes

- Make `useReactiveVar(rv)` recheck the latest `rv()` value in its `useEffect` callback, and immediately update state if the value has already changed, rather than calling `rv.onNextChange(setValue)` to listen for future changes. <br/>
  [@benjamn](https://github.com/benjamn) in [#8135](https://github.com/apollographql/apollo-client/pull/8135)

## Apollo Client 3.3.16

### Bug fixes

- Prevent `undefined` mutation result in `useMutation`. <br/>
  [@jcreighton](https://github.com/jcreighton) in [#8018](https://github.com/apollographql/apollo-client/pull/8018)

- Fix `useReactiveVar` not rerendering for successive synchronous calls. <br/>
  [@brainkim](https://github.com/brainkim) in [#8022](https://github.com/apollographql/apollo-client/pull/8022)

- Support `batchDebounce` option for `BatchLink` and `BatchHttpLink`. <br/>
  [@dannycochran](https://github.com/dannycochran) in [#8024](https://github.com/apollographql/apollo-client/pull/8024)

## Apollo Client 3.3.15

- Increment `queryInfo.lastRequestId` only when making a network request through the `ApolloLink` chain, rather than every time `fetchQueryByPolicy` is called. <br/>
  [@dannycochran](https://github.com/dannycochran) in [#7956](https://github.com/apollographql/apollo-client/pull/7956)

- During server-side rendering, allow initial `useQuery` calls to return final `{ loading: false, data }` results when the cache already contains the necessary data. <br/>
  [@benjamn](https://github.com/benjamn) in [#7983](https://github.com/apollographql/apollo-client/pull/7983)

## Apollo Client 3.3.14

### Improvements

- Adjust TypeScript types to allow `keyFields` and `keyArgs` functions to return `false`. <br/>
  [@CarsonF](https://github.com/CarsonF) and [@benjamn](https://github.com/benjamn) in [#7900](https://github.com/apollographql/apollo-client/pull/7900)

### Bug fixes

- Prevent `RenderPromises` memory leak by calling `renderPromises.clear()` after `getMarkupFromTree` finishes. <br/>
  [@benjamn](https://github.com/benjamn) in [#7943](https://github.com/apollographql/apollo-client/pull/7943)

- Cancel pending notify timeout when stopping a `QueryInfo` object. <br/>
  [@hollandThomas](https://github.com/hollandThomas) in [#7935](https://github.com/apollographql/apollo-client/pull/7935)

- Fix infinite rendering bug related to `useSubscription`. <br/>
  [@brainkim](https://github.com/brainkim) in [#7917](https://github.com/apollographql/apollo-client/pull/7917)

## Apollo Client 3.3.13

### Improvements

- Add missing `context` option to `useSubscription`. <br />
  [@jcreighton](https://github.com/jcreighton) in [#7860](https://github.com/apollographql/apollo-client/pull/7860)

- Remove unnecessary TypeScript global `Observable<T>["@@observable"]` method declaration. <br/>
  [@benjamn](https://github.com/benjamn) in [#7888](https://github.com/apollographql/apollo-client/pull/7888)

- Prevent skipped/observerless `ObservableQuery`s from being refetched by `refetchQueries`. <br/>
  [@dannycochran](https://github.com/dannycochran) in [#7877](https://github.com/apollographql/apollo-client/pull/7877)

## Apollo Client 3.3.12

### Bug fixes

- Maintain serial ordering of `asyncMap` mapping function calls, and prevent potential unhandled `Promise` rejection errors. <br/>
  [@benjamn](https://github.com/benjamn) in [#7818](https://github.com/apollographql/apollo-client/pull/7818)

- Relax incompatible `children?: React.ReactElement` field type in `MockedProviderProps` interface. <br/>
  [@kevinperaza](https://github.com/kevinperaza) in [#7833](https://github.com/apollographql/apollo-client/pull/7833)

## Apollo Client 3.3.11

### Bug fixes

- Fix `useLazyQuery` `forceUpdate` loop regression introduced by [#7655](https://github.com/apollographql/apollo-client/pull/7655) in version 3.3.10. <br/>
  [@benjamn](https://github.com/benjamn) in [#7715](https://github.com/apollographql/apollo-client/pull/7715)

## Apollo Client 3.3.10

### Bug fixes

- Revert PR [#7276](https://github.com/apollographql/apollo-client/pull/7276), but test that garbage collection reclaims torn-down `ObservableQuery` objects. <br/>
  [@benjamn](https://github.com/benjamn) in [#7695](https://github.com/apollographql/apollo-client/pull/7695)

- Reset `QueryInfo.diff` and `QueryInfo.dirty` after canceling notify timeout in `QueryInfo.markResult` and `QueryInfo.markError`. <br/>
  [@jcreighton](https://github.com/jcreighton) in [#7696](https://github.com/apollographql/apollo-client/pull/7696)

### Improvements

- Avoid calling `forceUpdate` when component is unmounted. <br/>
  [@DylanVann](https://github.com/DylanVann) in [#7655](https://github.com/apollographql/apollo-client/pull/7655)

- The `codemods/` top-level directory has been moved into the `scripts/` directory. <br/>
  [@benjamn](https://github.com/benjamn) in [#7675](https://github.com/apollographql/apollo-client/pull/7675)

## Apollo Client 3.3.9

### Bug Fixes

- Prevent reactive variables from retaining otherwise unreachable `InMemoryCache` objects. <br/>
  [@benjamn](https://github.com/benjamn) in [#7661](https://github.com/apollographql/apollo-client/pull/7661)

### Improvements

- The [`graphql-tag`](https://www.npmjs.com/package/graphql-tag) dependency has been updated to version 2.12.0, after converting its repository to use TypeScript and ECMAScript module syntax. There should be no visible changes in behavior, though the internal changes seemed significant enough to mention here. <br/>
  [@abdonrd](https://github.com/abdonrd) in [graphql-tag#273](https://github.com/apollographql/graphql-tag/pull/273) and
  [@PowerKiKi](https://github.com/PowerKiKi) in [graphql-tag#325](https://github.com/apollographql/graphql-tag/pull/325)

## Apollo Client 3.3.8

### Bug Fixes

- Catch updates in `useReactiveVar` with an additional check. <br/>
  [@jcreighton](https://github.com/jcreighton) in [#7652](https://github.com/apollographql/apollo-client/pull/7652)

- Reactivate forgotten reactive variables whenever `InMemoryCache` acquires its first watcher. <br/>
  [@benjamn](https://github.com/benjamn) in [#7657](https://github.com/apollographql/apollo-client/pull/7657)

- Backport `Symbol.species` fix for `Concast` and `ObservableQuery` from [`release-3.4`](https://github.com/apollographql/apollo-client/pull/7399), fixing subscriptions in React Native Android when the Hermes JavaScript engine is enabled (among other benefits). <br/>
  [@benjamn](https://github.com/benjamn) in [#7403](https://github.com/apollographql/apollo-client/pull/7403) and [#7660](https://github.com/apollographql/apollo-client/pull/7660)

## Apollo Client 3.3.7

### Bug Fixes

- Fix a regression due to [#7310](https://github.com/apollographql/apollo-client/pull/7310) that caused `loading` always to be `true` for `skip: true` results during server-side rendering. <br/>
  [@rgrove](https://github.com/rgrove) in [#7567](https://github.com/apollographql/apollo-client/pull/7567)

- Avoid duplicate `useReactiveVar` listeners when rendering in `React.StrictMode`. <br/>
  [@jcreighton](https://github.com/jcreighton) in [#7581](https://github.com/apollographql/apollo-client/pull/7581)

### Improvements

- Set `displayName` on `ApolloContext` objects for easier debugging. <br/>
  [@dulmandakh](https://github.com/dulmandakh) in [#7550](https://github.com/apollographql/apollo-client/pull/7550)

## Apollo Client 3.3.6

### Bug Fixes

- Immediately apply `queryType: true`, `mutationType: true`, and `subscriptionType: true` type policies, rather than waiting for the first time the policy is used, fixing a [regression](https://github.com/apollographql/apollo-client/issues/7443) introduced by [#7065](https://github.com/apollographql/apollo-client/pull/7065). <br/>
  [@benjamn](https://github.com/benjamn) in [#7463](https://github.com/apollographql/apollo-client/pull/7463)

- Check that `window` is defined even when `connectToDevTools` is `true`. <br/>
  [@yasupeke](https://github.com/yasupeke) in [#7434](https://github.com/apollographql/apollo-client/pull/7434)

### Improvements

- Replace stray `console.debug` (undefined in React Native) with `invariant.log`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7454](https://github.com/apollographql/apollo-client/pull/7454)

- Suggest Firefox Apollo DevTools as well as the Chrome extension. <br/>
  [@benjamn](https://github.com/benjamn) in [#7461](https://github.com/apollographql/apollo-client/pull/7461)

## Apollo Client 3.3.5

### Improvements

- Restore `client.version` property, reflecting the current `@apollo/client` version from `package.json`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7448](https://github.com/apollographql/apollo-client/pull/7448)

## Apollo Client 3.3.4

### Improvements

- Update `ts-invariant` to avoid potential [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)-violating `Function` fallback, thanks to [a clever new `globalThis` polyfill technique](https://mathiasbynens.be/notes/globalthis). <br/>
  [@benjamn](https://github.com/benjamn) in [#7414](https://github.com/apollographql/apollo-client/pull/7414)

## Apollo Client 3.3.3

### Bug fixes

- Make the `observer` parameter of `ApolloLink#onError` optional, fixing an unnecessary breaking change for any code that called `onError` directly. <br/>
  [@benjamn](https://github.com/benjamn) in [#7407](https://github.com/apollographql/apollo-client/pull/7407)

## Apollo Client 3.3.2

> ⚠️ **Note:** This version of `@apollo/client` contains no behavioral changes since version 3.3.1

### Documentation

- The [Pagination](https://www.apollographql.com/docs/react/pagination/overview/) article has been completely rewritten (and split into multiple pages) to cover Apollo Client 3 field policies. <br/>
  [@benjamn](https://github.com/benjamn) and [@StephenBarlow](https://github.com/StephenBarlow) in [#7175](https://github.com/apollographql/apollo-client/pull/7175)

- Revamp [local state tutorial chapter](https://www.apollographql.com/tutorials/fullstack-quickstart/managing-local-state) for Apollo Client 3, including reactive variables. <br/>
  [@StephenBarlow](https://github.com/StephenBarlow) in [`apollographql@apollo#1050`](https://github.com/apollographql/apollo/pull/1050)

- Add examples of using `ApolloLink` to modify response data asynchronously. <br/>
  [@alichry](https://github.com/alichry) in [#7332](https://github.com/apollographql/apollo-client/pull/7332)

- Consolidate separate v2.4, v2.5, and v2.6 documentation versions into one v2 version. <br/>
  [@jgarrow](https://github.com/jgarrow) in [#7378](https://github.com/apollographql/apollo-client/pull/7378)

## Apollo Client 3.3.1

### Bug Fixes

- Revert back to `default`-importing `React` internally, rather than using a namespace import. <br/>
  [@benjamn](https://github.com/benjamn) in [113475b1](https://github.com/apollographql/apollo-client/commit/113475b163a19a40a67465c11e8e6f48a1de7e76)

## Apollo Client 3.3.0

### Bug Fixes

- Update `@wry/equality` to consider undefined properties equivalent to missing properties. <br/>
  [@benjamn](https://github.com/benjamn) in [#7108](https://github.com/apollographql/apollo-client/pull/7108)

- Prevent memory leaks involving unused `onBroadcast` function closure created in `ApolloClient` constructor. <br/>
  [@kamilkisiela](https://github.com/kamilkisiela) in [#7161](https://github.com/apollographql/apollo-client/pull/7161)

- Provide default empty cache object for root IDs like `ROOT_QUERY`, to avoid differences in behavior before/after `ROOT_QUERY` data has been written into `InMemoryCache`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7100](https://github.com/apollographql/apollo-client/pull/7100)

- Cancel `queryInfo.notifyTimeout` in `QueryInfo#markResult` to prevent unnecessary network requests when using a `FetchPolicy` of `cache-and-network` or `network-only` in a React component with multiple `useQuery` calls. <br/>
  [@benjamn](https://github.com/benjamn) in [#7347](https://github.com/apollographql/apollo-client/pull/7347)

### Potentially breaking changes

- Ensure `cache.readQuery` and `cache.readFragment` always return `TData | null`, instead of throwing `MissingFieldError` exceptions when missing fields are encountered. <br/>
  [@benjamn](https://github.com/benjamn) in [#7098](https://github.com/apollographql/apollo-client/pull/7098)

  > Since this change converts prior exceptions to `null` returns, and since `null` was already a possible return value according to the `TData | null` return type, we are confident this change will be backwards compatible (as long as `null` was properly handled before).

- `HttpLink` will now automatically strip any unused `variables` before sending queries to the GraphQL server, since those queries are very likely to fail validation, according to the [All Variables Used](https://spec.graphql.org/draft/#sec-All-Variables-Used) rule in the GraphQL specification. If you depend on the preservation of unused variables, you can restore the previous behavior by passing `includeUnusedVariables: true` to the `HttpLink` constructor (which is typically passed as `options.link` to the `ApolloClient` constructor). <br/>
  [@benjamn](https://github.com/benjamn) in [#7127](https://github.com/apollographql/apollo-client/pull/7127)

- Ensure `MockLink` (used by `MockedProvider`) returns mock configuration errors (e.g. `No more mocked responses for the query ...`) through the Link's `Observable`, instead of throwing them. These errors are now available through the `error` property of a result. <br/>
  [@hwillson](https://github.com/hwillson) in [#7110](https://github.com/apollographql/apollo-client/pull/7110)

  > Returning mock configuration errors through the Link's `Observable` was the default behavior in Apollo Client 2.x. We changed it for 3, but the change has been problematic for those looking to migrate from 2.x to 3. We've decided to change this back with the understanding that not many people want or are relying on `MockLink`'s throwing exception approach. If you want to change this functionality, you can define custom error handling through `MockLink.setOnError`.

- Unsubscribing the last observer from an `ObservableQuery` will once again unsubscribe from the underlying network `Observable` in all cases, as in Apollo Client 2.x, allowing network requests to be cancelled by unsubscribing. <br/>
  [@javier-garcia-meteologica](https://github.com/javier-garcia-meteologica) in [#7165](https://github.com/apollographql/apollo-client/pull/7165) and [#7170](https://github.com/apollographql/apollo-client/pull/7170).

- The independent `QueryBaseOptions` and `ModifiableWatchQueryOptions` interface supertypes have been eliminated, and their fields are now defined by `QueryOptions`. <br/>
  [@DCtheTall](https://github.com/DCtheTall) in [#7136](https://github.com/apollographql/apollo-client/pull/7136)

- Internally, Apollo Client now avoids nested imports from the `graphql` package, importing everything from the top-level package instead. For example,
  ```ts
  import { visit } from "graphql/language/visitor";
  ```
  is now just
  ```ts
  import { visit } from "graphql";
  ```
  Since the `graphql` package uses `.mjs` modules, your bundler may need to be configured to recognize `.mjs` files as ECMAScript modules rather than CommonJS modules. <br/>
  [@benjamn](https://github.com/benjamn) in [#7185](https://github.com/apollographql/apollo-client/pull/7185)

### Improvements

- Support inheritance of type and field policies, according to `possibleTypes`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7065](https://github.com/apollographql/apollo-client/pull/7065)

- Allow configuring custom `merge` functions, including the `merge: true` and `merge: false` shorthands, in type policies as well as field policies. <br/>
  [@benjamn](https://github.com/benjamn) in [#7070](https://github.com/apollographql/apollo-client/pull/7070)

- The verbosity of Apollo Client console messages can be globally adjusted using the `setLogVerbosity` function:

  ```ts
  import { setLogVerbosity } from "@apollo/client";
  setLogVerbosity("log"); // display all messages
  setLogVerbosity("warn"); // display only warnings and errors (default)
  setLogVerbosity("error"); // display only errors
  setLogVerbosity("silent"); // hide all console messages
  ```

  Remember that all logs, warnings, and errors are hidden in production. <br/>
  [@benjamn](https://github.com/benjamn) in [#7226](https://github.com/apollographql/apollo-client/pull/7226)

- Modifying `InMemoryCache` fields that have `keyArgs` configured will now invalidate only the field value with matching key arguments, rather than invalidating all field values that share the same field name. If `keyArgs` has not been configured, the cache must err on the side of invalidating by field name, as before. <br/>
  [@benjamn](https://github.com/benjamn) in [#7351](https://github.com/apollographql/apollo-client/pull/7351)

- Shallow-merge `options.variables` when combining existing or default options with newly-provided options, so new variables do not completely overwrite existing variables. <br/>
  [@amannn](https://github.com/amannn) in [#6927](https://github.com/apollographql/apollo-client/pull/6927)

- Avoid displaying `Cache data may be lost...` warnings for scalar field values that happen to be objects, such as JSON data. <br/>
  [@benjamn](https://github.com/benjamn) in [#7075](https://github.com/apollographql/apollo-client/pull/7075)

- In addition to the `result.data` property, `useQuery` and `useLazyQuery` will now provide a `result.previousData` property, which can be useful when a network request is pending and `result.data` is undefined, since `result.previousData` can be rendered instead of rendering an empty/loading state. <br/>
  [@hwillson](https://github.com/hwillson) in [#7082](https://github.com/apollographql/apollo-client/pull/7082)

- Passing `validate: true` to the `SchemaLink` constructor will enable validation of incoming queries against the local schema before execution, returning validation errors in `result.errors`, just like a non-local GraphQL endpoint typically would. <br/>
  [@amannn](https://github.com/amannn) in [#7094](https://github.com/apollographql/apollo-client/pull/7094)

- Allow optional arguments in `keyArgs: [...]` arrays for `InMemoryCache` field policies. <br/>
  [@benjamn](https://github.com/benjamn) in [#7109](https://github.com/apollographql/apollo-client/pull/7109)

- Avoid registering `QueryPromise` when `skip` is `true` during server-side rendering. <br/>
  [@izumin5210](https://github.com/izumin5210) in [#7310](https://github.com/apollographql/apollo-client/pull/7310)

- `ApolloCache` objects (including `InMemoryCache`) may now be associated with or disassociated from individual reactive variables by calling `reactiveVar.attachCache(cache)` and/or `reactiveVar.forgetCache(cache)`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7350](https://github.com/apollographql/apollo-client/pull/7350)

## Apollo Client 3.2.9

### Bug Fixes

- Revert back to `default`-importing `React` internally, rather than using a namespace import. <br/>
  [@benjamn](https://github.com/benjamn) in [113475b1](https://github.com/apollographql/apollo-client/commit/113475b163a19a40a67465c11e8e6f48a1de7e76)

## Apollo Client 3.2.8

### Bug Fixes

- Ensure `sourcesContent` array is properly defined in `.js.map` files generated by `tsc`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7371](https://github.com/apollographql/apollo-client/pull/7371)

- Avoid relying on global `Symbol` properties in `ApolloContext.ts`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7371](https://github.com/apollographql/apollo-client/pull/7371)

## Apollo Client 3.2.7

### Bug Fixes

- Revert updating `symbol-observable` from version 2.x to version 3, which caused TypeScript errors with some `@types/node` versions, especially in Angular applications. <br/>
  [@benjamn](https://github.com/benjamn) in [#7340](https://github.com/apollographql/apollo-client/pull/7340)

## Apollo Client 3.2.6

### Bug Fixes

- Always consider singleton IDs like `ROOT_QUERY` and `ROOT_MUTATION` to be root IDs during `cache.gc` garbage collection, regardless of whether they have been retained or released. <br/>
  [@benjamn](https://github.com/benjamn) in [#7333](https://github.com/apollographql/apollo-client/pull/7333)

- Use optional chaining syntax (`this.currentObservable?.refetch`) in React `refetch` wrapper function to avoid crashing when an unmounted component is accidentally refetched. <br/>
  [@tm1000](https://github.com/tm1000) in [#6314](https://github.com/apollographql/apollo-client/pull/6314) and
  [@linmic](https://github.com/linmic) in [#7186](https://github.com/apollographql/apollo-client/pull/7186)

### Improvements

- Handle older `react-apollo` package in `codemods/ac2-to-ac3/imports.js` migration script. <br/>
  [@tm1000](https://github.com/tm1000) in [#7216](https://github.com/apollographql/apollo-client/pull/7216)

- Ensure `relayStylePagination` preserves `pageInfo.{start,end}Cursor` if `edges` is missing or empty. <br/>
  [@beaucollins](https://github.com/beaucollins) in [#7224](https://github.com/apollographql/apollo-client/pull/7224)

## Apollo Client 3.2.5

### Improvements

- Move `terser` dependency from `dependencies` to `devDependencies`. <br/>
  [@SimenB](https://github.com/SimenB) in [#7188](https://github.com/apollographql/apollo-client/pull/7188)

- Avoid all sub-package imports from the `graphql` npm package. <br/>
  [@stoically](https://github.com/stoically) in [#7185](https://github.com/apollographql/apollo-client/pull/7185)

## Apollo Client 3.2.4

### Improvements

- Update the `optimism` npm dependency to version 0.13.0 in order to use the new `optimistic.forget` method to fix a potential `cache.watch` memory leak. <br/>
  [@benjamn](https://github.com/benjamn) in [#7157](https://github.com/apollographql/apollo-client/pull/7157)

- Consider `cache.reset` a destructive method, like `cache.evict` and `cache.modify`. <br/>
  [@joshjg](https://github.com/joshjg) in [#7150](https://github.com/apollographql/apollo-client/pull/7150)

- Avoid refetching observerless queries with `reFetchObservableQueries`. <br/>
  [@joshjg](https://github.com/joshjg) in [#7146](https://github.com/apollographql/apollo-client/pull/7146)

## Apollo Client 3.2.3

### Improvements

- Default `args.offset` to zero in `offsetLimitPagination`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7141](https://github.com/apollographql/apollo-client/pull/7141)

## Apollo Client 3.2.2

### Bug Fixes

- Undo `TEdgeWrapper` approach for `relayStylePagination`, introduced by [f41e9efc](https://github.com/apollographql/apollo-client/commit/f41e9efc9e061b80fe5019456c049a3c56661e87) in [#7023](https://github.com/apollographql/apollo-client/pull/7023), since it was an unintended breaking change for existing code that used `cache.modify` to interact with field data managed by `relayStylePagination`. <br/>
  [@benjamn](https://github.com/benjamn) in [#7103](https://github.com/apollographql/apollo-client/pull/7103)

## Apollo Client 3.2.1

### Bug Fixes

- Fix `relayStylePagination` to handle the possibility that edges might be normalized `Reference` objects (uncommon). <br/>
  [@anark](https://github.com/anark) and [@benjamn](https://github.com/benjamn) in [#7023](https://github.com/apollographql/apollo-client/pull/7023)

- Disable "Missing cache result fields" warnings when `returnPartialData` is `true`. <br/>
  [@hwillson](https://github.com/hwillson) in [#7055](https://github.com/apollographql/apollo-client/pull/7055)

### Improvements

- Mark `subscriptions-transport-ws` `peerDependency` as optional. <br/>
  [@MasterOdin](https://github.com/MasterOdin) in [#7047](https://github.com/apollographql/apollo-client/pull/7047)

## Apollo Client 3.2.0

### Bug Fixes

- Use `options.nextFetchPolicy` internally to restore original `FetchPolicy` after polling with `fetchPolicy: "network-only"`, so that polling does not interfere with normal query watching. <br/>
  [@benjamn](https://github.com/benjamn) in [#6893](https://github.com/apollographql/apollo-client/pull/6893)

- Initialize `ObservableQuery` in `updateObservableQuery` even if `skip` is `true`. <br/>
  [@mu29](https://github.com/mu29) in [#6999](https://github.com/apollographql/apollo-client/pull/6999)

- Prevent full reobservation of queries affected by optimistic mutation updates, while still delivering results from the cache. <br/>
  [@benjamn](https://github.com/benjamn) in [#6854](https://github.com/apollographql/apollo-client/pull/6854)

### Improvements

- In TypeScript, all APIs that take `DocumentNode` parameters now may alternatively take `TypeDocumentNode<Data, Variables>`. This type has the same JavaScript representation but allows the APIs to infer the data and variable types instead of requiring you to specify types explicitly at the call site. <br/>
  [@dotansimha](https://github.com/dotansimha) in [#6720](https://github.com/apollographql/apollo-client/pull/6720)

- Bring back an improved form of heuristic fragment matching, by allowing `possibleTypes` to specify subtype regular expression strings, which count as matches if the written result object has all the fields expected for the fragment. <br/>
  [@benjamn](https://github.com/benjamn) in [#6901](https://github.com/apollographql/apollo-client/pull/6901)

- Allow `options.nextFetchPolicy` to be a function that takes the current `FetchPolicy` and returns a new (or the same) `FetchPolicy`, making `nextFetchPolicy` more suitable for global use in `defaultOptions.watchQuery`. <br/>
  [@benjamn](https://github.com/benjamn) in [#6893](https://github.com/apollographql/apollo-client/pull/6893)

- Implement `useReactiveVar` hook for consuming reactive variables in React components. <br/>
  [@benjamn](https://github.com/benjamn) in [#6867](https://github.com/apollographql/apollo-client/pull/6867)

- Move `apollo-link-persisted-queries` implementation to `@apollo/client/link/persisted-queries`. Try running our [automated imports transform](https://github.com/apollographql/apollo-client/tree/main/scripts/codemods/ac2-to-ac3) to handle this conversion, if you're using `apollo-link-persisted-queries`. <br/>
  [@hwillson](https://github.com/hwillson) in [#6837](https://github.com/apollographql/apollo-client/pull/6837)

- Disable feud-stopping logic after any `cache.evict` or `cache.modify` operation. <br/>
  [@benjamn](https://github.com/benjamn) in
  [#6817](https://github.com/apollographql/apollo-client/pull/6817) and
  [#6898](https://github.com/apollographql/apollo-client/pull/6898)

- Throw if `writeFragment` cannot identify `options.data` when no `options.id` provided. <br/>
  [@jcreighton](https://github.com/jcreighton) in [#6859](https://github.com/apollographql/apollo-client/pull/6859)

- Provide `options.storage` object to `cache.modify` functions, as provided to `read` and `merge` functions. <br/>
  [@benjamn](https://github.com/benjamn) in [#6991](https://github.com/apollographql/apollo-client/pull/6991)

- Allow `cache.modify` functions to return `details.INVALIDATE` (similar to `details.DELETE`) to invalidate the current field, causing affected queries to rerun, even if the field's value is unchanged. <br/>
  [@benjamn](https://github.com/benjamn) in [#6991](https://github.com/apollographql/apollo-client/pull/6991)

- Support non-default `ErrorPolicy` values (that is, `"ignore"` and `"all"`, in addition to the default value `"none"`) for mutations and subscriptions, like we do for queries. <br/>
  [@benjamn](https://github.com/benjamn) in [#7003](https://github.com/apollographql/apollo-client/pull/7003)

- Remove invariant forbidding a `FetchPolicy` of `cache-only` in `ObservableQuery#refetch`. <br/>
  [@benjamn](https://github.com/benjamn) in [ccb0a79a](https://github.com/apollographql/apollo-client/pull/6774/commits/ccb0a79a588721f08bf87a131c31bf37fa3238e5), fixing [#6702](https://github.com/apollographql/apollo-client/issues/6702)

## Apollo Client 3.1.5

### Bug Fixes

- Make `ApolloQueryResult.data` field non-optional again. <br/>
  [@benjamn](https://github.com/benjamn) in [#6997](https://github.com/apollographql/apollo-client/pull/6997)

### Improvements

- Allow querying `Connection` metadata without `args` in `relayStylePagination`. <br/>
  [@anark](https://github.com/anark) in [#6935](https://github.com/apollographql/apollo-client/pull/6935)

## Apollo Client 3.1.4

### Bug Fixes

- Restrict root object identification to `ROOT_QUERY` (the ID corresponding to the root `Query` object), allowing `Mutation` and `Subscription` as user-defined types. <br/>
  [@benjamn](https://github.com/benjamn) in [#6914](https://github.com/apollographql/apollo-client/pull/6914)

- Prevent crash when `pageInfo` and empty `edges` are received by `relayStylePagination`. <br/>
  [@fracmak](https://github.com/fracmak) in [#6918](https://github.com/apollographql/apollo-client/pull/6918)

## Apollo Client 3.1.3

### Bug Fixes

- Consider only `result.data` (rather than all properties of `result`) when settling cache feuds. <br/>
  [@danReynolds](https://github.com/danReynolds) in [#6777](https://github.com/apollographql/apollo-client/pull/6777)

### Improvements

- Provide [jscodeshift](https://www.npmjs.com/package/jscodeshift) transform for automatically converting Apollo Client 2.x `import` declarations to use Apollo Client 3.x packages. [Instructions](https://github.com/apollographql/apollo-client/tree/main/scripts/codemods/ac2-to-ac3). <br/>
  [@dminkovsky](https://github.com/dminkovsky) and [@jcreighton](https://github.com/jcreighton) in [#6486](https://github.com/apollographql/apollo-client/pull/6486)

## Apollo Client 3.1.2

### Bug Fixes

- Avoid making network requests when `skip` is `true`. <br/>
  [@hwillson](https://github.com/hwillson) in [#6752](https://github.com/apollographql/apollo-client/pull/6752)

### Improvements

- Allow `SchemaLink.Options.context` function to be `async` (or return a `Promise`). <br/>
  [@benjamn](https://github.com/benjamn) in [#6735](https://github.com/apollographql/apollo-client/pull/6735)

## Apollo Client 3.1.1

### Bug Fixes

- Re-export cache types from `@apollo/client/core` (and thus also `@apollo/client`), again. <br/>
  [@benjamn](https://github.com/benjamn) in [#6725](https://github.com/apollographql/apollo-client/pull/6725)

## Apollo Client 3.1.0

### Bug Fixes

- Rework interdependencies between `@apollo/client/*` entry points, so that CommonJS and ESM modules are supported equally well, without any duplication of shared code. <br/>
  [@benjamn](https://github.com/benjamn) in [#6656](https://github.com/apollographql/apollo-client/pull/6656) and
  [#6657](https://github.com/apollographql/apollo-client/pull/6657)

- Tolerate `!==` callback functions (like `onCompleted` and `onError`) in `useQuery` options, since those functions are almost always freshly evaluated each time `useQuery` is called. <br/>
  [@hwillson](https://github.com/hwillson) and [@benjamn](https://github.com/benjamn) in [#6588](https://github.com/apollographql/apollo-client/pull/6588)

- Respect `context.queryDeduplication` if provided, and otherwise fall back to `client.deduplication` (as before). <br/>
  [@igaloly](https://github.com/igaloly) in [#6261](https://github.com/apollographql/apollo-client/pull/6261) and
  [@Kujawadl](https://github.com/Kujawadl) in [#6526](https://github.com/apollographql/apollo-client/pull/6526)

- Refactor `ObservableQuery#getCurrentResult` to reenable immediate delivery of warm cache results. As part of this refactoring, the `ApolloCurrentQueryResult` type was eliminated in favor of `ApolloQueryResult`. <br/>
  [@benjamn](https://github.com/benjamn) in [#6710](https://github.com/apollographql/apollo-client/pull/6710)

- Avoid clobbering `defaultOptions` with `undefined` values. <br/>
  [@benjamn](https://github.com/benjamn) in [#6715](https://github.com/apollographql/apollo-client/pull/6715)

### Improvements

- Apollo Client will no longer modify `options.fetchPolicy` unless you pass `options.nextFetchPolicy` to request an explicit change in `FetchPolicy` after the current request. Although this is technically a breaking change, `options.nextFieldPolicy` makes it easy to restore the old behavior (by passing `cache-first`). <br/>
  [@benjamn](https://github.com/benjamn) in [#6712](https://github.com/apollographql/apollo-client/pull/6712), reverting [#6353](https://github.com/apollographql/apollo-client/pull/6353)

- Errors of the form `Invariant Violation: 42` thrown in production can now be looked up much more easily, by consulting the auto-generated `@apollo/client/invariantErrorCodes.js` file specific to your `@apollo/client` version. <br/>
  [@benjamn](https://github.com/benjamn) in [#6665](https://github.com/apollographql/apollo-client/pull/6665)

- Make the `client` field of the `MutationResult` type non-optional, since it is always provided. <br/>
  [@glasser](https://github.com/glasser) in [#6617](https://github.com/apollographql/apollo-client/pull/6617)

- Allow passing an asynchronous `options.renderFunction` to `getMarkupFromTree`. <br/>
  [@richardscarrott](https://github.com/richardscarrott) in [#6576](https://github.com/apollographql/apollo-client/pull/6576)

- Ergonomic improvements for `merge` and `keyArgs` functions in cache field policies. <br/>
  [@benjamn](https://github.com/benjamn) in [#6714](https://github.com/apollographql/apollo-client/pull/6714)

## Apollo Client 3.0.2

### Bug Fixes

- Avoid duplicating `graphql/execution/execute` dependency in CommonJS bundle for `@apollo/client/link/schema`, fixing `instanceof` errors reported in [#6621](https://github.com/apollographql/apollo-client/issues/6621) and [#6614](https://github.com/apollographql/apollo-client/issues/6614). <br/>
  [@benjamn](https://github.com/benjamn) in [#6624](https://github.com/apollographql/apollo-client/pull/6624)

## Apollo Client 3.0.1

### Bug Fixes

- Make sure `useQuery` `onCompleted` is not fired when `skip` is `true`. <br/>
  [@hwillson](https://github.com/hwillson) in [#6589](https://github.com/apollographql/apollo-client/pull/6589)

- Revert changes to `peerDependencies` in `package.json` ([#6594](https://github.com/apollographql/apollo-client/pull/6594)), which would have allowed using incompatible future versions of `graphql` and/or `react` due to overly-permissive `>=` version constraints. <br/>
  [@hwillson](https://github.com/hwillson) in [#6605](https://github.com/apollographql/apollo-client/pull/6605)

# Apollo Client 3.0.0

## Improvements

> ⚠️ **Note:** As of 3.0.0, Apollo Client uses a new package name: [`@apollo/client`](https://www.npmjs.com/package/@apollo/client)

### `ApolloClient`

- **[BREAKING]** `ApolloClient` is now only available as a named export. The default `ApolloClient` export has been removed. <br/>
  [@hwillson](https://github.com/hwillson) in [#5425](https://github.com/apollographql/apollo-client/pull/5425)

- **[BREAKING]** The `queryManager` property of `ApolloClient` instances is now marked as `private`, paving the way for a more aggressive redesign of its API.

- **[BREAKING]** Apollo Client will no longer deliver "stale" results to `ObservableQuery` consumers, but will instead log more helpful errors about which cache fields were missing. <br/>
  [@benjamn](https://github.com/benjamn) in [#6058](https://github.com/apollographql/apollo-client/pull/6058)

- **[BREAKING]** `ApolloError`'s thrown by Apollo Client no longer prefix error messages with `GraphQL error:` or `Network error:`. To differentiate between GraphQL/network errors, refer to `ApolloError`'s public `graphQLErrors` and `networkError` properties. <br/>
  [@lorensr](https://github.com/lorensr) in [#3892](https://github.com/apollographql/apollo-client/pull/3892)

- **[BREAKING]** Support for the `@live` directive has been removed, but might be restored in the future if a more thorough implementation is proposed. <br/>
  [@benjamn](https://github.com/benjamn) in [#6221](https://github.com/apollographql/apollo-client/pull/6221)

- **[BREAKING]** Apollo Client 2.x allowed `@client` fields to be passed into the `link` chain if `resolvers` were not set in the constructor. This allowed `@client` fields to be passed into Links like `apollo-link-state`. Apollo Client 3 enforces that `@client` fields are local only, meaning they are no longer passed into the `link` chain, under any circumstances. <br/>
  [@hwillson](https://github.com/hwillson) in [#5982](https://github.com/apollographql/apollo-client/pull/5982)

- **[BREAKING?]** Refactor `QueryManager` to make better use of observables and enforce `fetchPolicy` more reliably. <br/>
  [@benjamn](https://github.com/benjamn) in [#6221](https://github.com/apollographql/apollo-client/pull/6221)

- The `updateQuery` function previously required by `fetchMore` has been deprecated with a warning, and will be removed in the next major version of Apollo Client. Please consider using a `merge` function to handle incoming data instead of relying on `updateQuery`. <br/>
  [@benjamn](https://github.com/benjamn) in [#6464](https://github.com/apollographql/apollo-client/pull/6464)

  - Helper functions for generating common pagination-related field policies may be imported from `@apollo/client/utilities`. The most basic helper is `concatPagination`, which emulates the concatenation behavior of typical `updateQuery` functions. A more sophisticated helper is `offsetLimitPagination`, which implements offset/limit-based pagination. If you are consuming paginated data from a Relay-friendly API, use `relayStylePagination`. Feel free to use [these helper functions](https://github.com/apollographql/apollo-client/blob/main/src/utilities/policies/pagination.ts) as inspiration for your own field policies, and/or modify them to suit your needs. <br/>
    [@benjamn](https://github.com/benjamn) in [#6465](https://github.com/apollographql/apollo-client/pull/6465)

- Updated to work with `graphql@15`. <br/>
  [@durchanek](https://github.com/durchanek) in [#6194](https://github.com/apollographql/apollo-client/pull/6194) and [#6279](https://github.com/apollographql/apollo-client/pull/6279) <br/>
  [@hagmic](https://github.com/hagmic) in [#6328](https://github.com/apollographql/apollo-client/pull/6328)

- Apollo Link core and HTTP related functionality has been merged into `@apollo/client`. Functionality that was previously available through the `apollo-link`, `apollo-link-http-common` and `apollo-link-http` packages is now directly available from `@apollo/client` (e.g. `import { HttpLink } from '@apollo/client'`). The `ApolloClient` constructor has also been updated to accept new `uri`, `headers` and `credentials` options. If `uri` is specified, Apollo Client will take care of creating the necessary `HttpLink` behind the scenes. <br/>
  [@hwillson](https://github.com/hwillson) in [#5412](https://github.com/apollographql/apollo-client/pull/5412)

- The `gql` template tag should now be imported from the `@apollo/client` package, rather than the `graphql-tag` package. Although the `graphql-tag` package still works for now, future versions of `@apollo/client` may change the implementation details of `gql` without a major version bump. <br/>
  [@hwillson](https://github.com/hwillson) in [#5451](https://github.com/apollographql/apollo-client/pull/5451)

- `@apollo/client/core` can be used to import the Apollo Client core, which includes everything the main `@apollo/client` package does, except for all React related functionality. <br/>
  [@kamilkisiela](https://github.com/kamilkisiela) in [#5541](https://github.com/apollographql/apollo-client/pull/5541)

- Several deprecated methods have been fully removed:

  - `ApolloClient#initQueryManager`
  - `QueryManager#startQuery`
  - `ObservableQuery#currentResult`

- Apollo Client now supports setting a new `ApolloLink` (or link chain) after `new ApolloClient()` has been called, using the `ApolloClient#setLink` method. <br/>
  [@hwillson](https://github.com/hwillson) in [#6193](https://github.com/apollographql/apollo-client/pull/6193)

- The final time a mutation `update` function is called, it can no longer accidentally read optimistic data from other concurrent mutations, which ensures the use of optimistic updates has no lasting impact on the state of the cache after mutations have finished. <br/>
  [@benjamn](https://github.com/benjamn) in [#6551](https://github.com/apollographql/apollo-client/pull/6551)

- Apollo links that were previously maintained in https://github.com/apollographql/apollo-link have been merged into the Apollo Client project. They should be accessed using the new entry points listed in the [migration guide](./docs/source/migrating/apollo-client-3-migration.md). <br/>
  [@hwillson](https://github.com/hwillson) in [#](TODO)

### `InMemoryCache`

> ⚠️ **Note:** `InMemoryCache` has been significantly redesigned and rewritten in Apollo Client 3.0. Please consult the [migration guide](https://www.apollographql.com/docs/react/v3.0-beta/migrating/apollo-client-3-migration/#cache-improvements) and read the new [documentation](https://www.apollographql.com/docs/react/v3.0-beta/caching/cache-configuration/) to understand everything that has been improved.

- The `InMemoryCache` constructor should now be imported directly from `@apollo/client`, rather than from a separate package. The `apollo-cache-inmemory` package is no longer supported.

  > The `@apollo/client/cache` entry point can be used to import `InMemoryCache` without importing other parts of the Apollo Client codebase. <br/> > [@hwillson](https://github.com/hwillson) in [#5577](https://github.com/apollographql/apollo-client/pull/5577)

- **[BREAKING]** `FragmentMatcher`, `HeuristicFragmentMatcher`, and `IntrospectionFragmentMatcher` have all been removed. We now recommend using `InMemoryCache`’s `possibleTypes` option instead. For more information see the [Defining `possibleTypes` manually](https://www.apollographql.com/docs/react/v3.0-beta/data/fragments/#defining-possibletypes-manually) section of the docs. <br/>
  [@benjamn](https://github.com/benjamn) in [#5073](https://github.com/apollographql/apollo-client/pull/5073)

- **[BREAKING]** As promised in the [Apollo Client 2.6 blog post](https://blog.apollographql.com/whats-new-in-apollo-client-2-6-b3acf28ecad1), all cache results are now frozen/immutable. <br/>
  [@benjamn](https://github.com/benjamn) in [#5153](https://github.com/apollographql/apollo-client/pull/5153)

- **[BREAKING]** Eliminate "generated" cache IDs to avoid normalizing objects with no meaningful ID, significantly reducing cache memory usage. This might be a backwards-incompatible change if your code depends on the precise internal representation of normalized data in the cache. <br/>
  [@benjamn](https://github.com/benjamn) in [#5146](https://github.com/apollographql/apollo-client/pull/5146)

- **[BREAKING]** `InMemoryCache` will no longer merge the fields of written objects unless the objects are known to have the same identity, and the values of fields with the same name will not be recursively merged unless a custom `merge` function is defined by a field policy for that field, within a type policy associated with the `__typename` of the parent object. <br/>
  [@benjamn](https://github.com/benjamn) in [#5603](https://github.com/apollographql/apollo-client/pull/5603)

- **[BREAKING]** `InMemoryCache` now _throws_ when data with missing or undefined query fields is written into the cache, rather than just warning in development. <br/>
  [@benjamn](https://github.com/benjamn) in [#6055](https://github.com/apollographql/apollo-client/pull/6055)

- **[BREAKING]** `client|cache.writeData` have been fully removed. `writeData` usage is one of the easiest ways to turn faulty assumptions about how the cache represents data internally, into cache inconsistency and corruption. `client|cache.writeQuery`, `client|cache.writeFragment`, and/or `cache.modify` can be used to update the cache. <br/>
  [@benjamn](https://github.com/benjamn) in [#5923](https://github.com/apollographql/apollo-client/pull/5923)

- `InMemoryCache` now supports tracing garbage collection and eviction. Note that the signature of the `evict` method has been simplified in a potentially backwards-incompatible way. <br/>
  [@benjamn](https://github.com/benjamn) in [#5310](https://github.com/apollographql/apollo-client/pull/5310)

  - **[beta-BREAKING]** Please note that the `cache.evict` method now requires `Cache.EvictOptions`, though it previously supported positional arguments as well. <br/>
    [@danReynolds](https://github.com/danReynolds) in [#6141](https://github.com/apollographql/apollo-client/pull/6141)
    [@benjamn](https://github.com/benjamn) in [#6364](https://github.com/apollographql/apollo-client/pull/6364)

  - Removing an entity object using the `cache.evict` method does not automatically remove dangling references to that entity elsewhere in the cache, but dangling references will be automatically filtered from lists whenever those lists are read from the cache. You can define a custom field `read` function to customize this behavior. See [#6412](https://github.com/apollographql/apollo-client/pull/6412), [#6425](https://github.com/apollographql/apollo-client/pull/6425), and [#6454](https://github.com/apollographql/apollo-client/pull/6454) for further explanation.

- Cache methods that would normally trigger a broadcast, like `cache.evict`, `cache.writeQuery`, and `cache.writeFragment`, can now be called with a named options object, which supports a `broadcast: boolean` property that can be used to silence the broadcast, for situations where you want to update the cache multiple times without triggering a broadcast each time. <br/>
  [@benjamn](https://github.com/benjamn) in [#6288](https://github.com/apollographql/apollo-client/pull/6288)

- `InMemoryCache` now `console.warn`s in development whenever non-normalized data is dangerously overwritten, with helpful links to documentation about normalization and custom `merge` functions. <br/>
  [@benjamn](https://github.com/benjamn) in [#6372](https://github.com/apollographql/apollo-client/pull/6372)

- The result caching system (introduced in [#3394](https://github.com/apollographql/apollo-client/pull/3394)) now tracks dependencies at the field level, rather than at the level of whole entity objects, allowing the cache to return identical (`===`) results much more often than before. <br/>
  [@benjamn](https://github.com/benjamn) in [#5617](https://github.com/apollographql/apollo-client/pull/5617)

- `InMemoryCache` now has a method called `modify` which can be used to update the value of a specific field within a specific entity object:

  ```ts
  cache.modify({
    id: cache.identify(post),
    fields: {
      comments(comments: Reference[], { readField }) {
        return comments.filter(
          (comment) => idToRemove !== readField("id", comment)
        );
      },
    },
  });
  ```

  This API gracefully handles cases where multiple field values are associated with a single field name, and also removes the need for updating the cache by reading a query or fragment, modifying the result, and writing the modified result back into the cache. Behind the scenes, the `cache.evict` method is now implemented in terms of `cache.modify`. <br/>
  [@benjamn](https://github.com/benjamn) in [#5909](https://github.com/apollographql/apollo-client/pull/5909)
  and [#6178](https://github.com/apollographql/apollo-client/pull/6178)

- `InMemoryCache` provides a new API for storing client state that can be updated from anywhere:

  ```ts
  import { makeVar } from "@apollo/client";
  const v = makeVar(123);
  console.log(v()); // 123
  console.log(v(v() + 1)); // 124
  console.log(v()); // 124
  v("asdf"); // TS type error
  ```

  These variables are _reactive_ in the sense that updating their values invalidates any previously cached query results that depended on the old values. <br/>
  [@benjamn](https://github.com/benjamn) in
  [#5799](https://github.com/apollographql/apollo-client/pull/5799),
  [#5976](https://github.com/apollographql/apollo-client/pull/5976), and
  [#6512](https://github.com/apollographql/apollo-client/pull/6512)

- Various cache read and write performance optimizations, cutting read and write times by more than 50% in larger benchmarks. <br/>
  [@benjamn](https://github.com/benjamn) in [#5948](https://github.com/apollographql/apollo-client/pull/5948)

- The `cache.readQuery` and `cache.writeQuery` methods now accept an `options.id` string, which eliminates most use cases for `cache.readFragment` and `cache.writeFragment`, and skips the implicit conversion of fragment documents to query documents performed by `cache.{read,write}Fragment`. <br/>
  [@benjamn](https://github.com/benjamn) in [#5930](https://github.com/apollographql/apollo-client/pull/5930)

- Support `cache.identify(entity)` for easily computing entity ID strings. <br/>
  [@benjamn](https://github.com/benjamn) in [#5642](https://github.com/apollographql/apollo-client/pull/5642)

- Support eviction of specific entity fields using `cache.evict(id, fieldName)`. <br/>
  [@benjamn](https://github.com/benjamn) in [#5643](https://github.com/apollographql/apollo-client/pull/5643)

- Make `InMemoryCache#evict` remove data from all `EntityStore` layers. <br/>
  [@benjamn](https://github.com/benjamn) in [#5773](https://github.com/apollographql/apollo-client/pull/5773)

- Stop paying attention to `previousResult` in `InMemoryCache`. <br/>
  [@benjamn](https://github.com/benjamn) in [#5644](https://github.com/apollographql/apollo-client/pull/5644)

- Improve optimistic update performance by limiting cache key diversity. <br/>
  [@benjamn](https://github.com/benjamn) in [#5648](https://github.com/apollographql/apollo-client/pull/5648)

- Custom field `read` functions can read from neighboring fields using the `readField(fieldName)` helper, and may also read fields from other entities by calling `readField(fieldName, objectOrReference)`. <br/>
  [@benjamn](https://github.com/benjamn) in [#5651](https://github.com/apollographql/apollo-client/pull/5651)

- Expose cache `modify` and `identify` to the mutate `update` function. <br/>
  [@hwillson](https://github.com/hwillson) in [#5956](https://github.com/apollographql/apollo-client/pull/5956)

- Add a default `gc` implementation to `ApolloCache`. <br/>
  [@justinwaite](https://github.com/justinwaite) in [#5974](https://github.com/apollographql/apollo-client/pull/5974)

### React

- **[BREAKING]** The `QueryOptions`, `MutationOptions`, and `SubscriptionOptions` React Apollo interfaces have been renamed to `QueryDataOptions`, `MutationDataOptions`, and `SubscriptionDataOptions` (to avoid conflicting with similarly named and exported Apollo Client interfaces).

- **[BREAKING]** Results with `loading: true` will no longer redeliver previous data, though they may provide partial data from the cache, when available. <br/>
  [@benjamn](https://github.com/benjamn) in [#6566](https://github.com/apollographql/apollo-client/pull/6566)

- **[BREAKING?]** Remove `fixPolyfills.ts`, except when bundling for React Native. If you have trouble with `Map` or `Set` operations due to frozen key objects in React Native, either update React Native to version 0.59.0 (or 0.61.x, if possible) or investigate why `fixPolyfills.native.js` is not included in your bundle. <br/>
  [@benjamn](https://github.com/benjamn) in [#5962](https://github.com/apollographql/apollo-client/pull/5962)

- The contents of the `@apollo/react-hooks` package have been merged into `@apollo/client`, enabling the following all-in-one `import`:

  ```ts
  import { ApolloClient, ApolloProvider, useQuery } from "@apollo/client";
  ```

  [@hwillson](https://github.com/hwillson) in [#5357](https://github.com/apollographql/apollo-client/pull/5357)

- React SSR features (previously accessed via `@apollo/react-ssr`) can now be accessed from the separate Apollo Client entry point of `@apollo/client/react/ssr`. These features are not included in the default `@apollo/client` bundle. <br/>
  [@hwillson](https://github.com/hwillson) in [#6499](https://github.com/apollographql/apollo-client/pull/6499)

### General

- **[BREAKING]** Removed `graphql-anywhere` since it's no longer used by Apollo Client. <br/>
  [@hwillson](https://github.com/hwillson) in [#5159](https://github.com/apollographql/apollo-client/pull/5159)

- **[BREAKING]** Removed `apollo-boost` since Apollo Client 3.0 provides a boost like getting started experience out of the box. <br/>
  [@hwillson](https://github.com/hwillson) in [#5217](https://github.com/apollographql/apollo-client/pull/5217)

- **[BREAKING]** We are no longer exporting certain (intended to be) internal utilities. If you are depending on some of the lesser known exports from `apollo-cache`, `apollo-cache-inmemory`, or `apollo-utilities`, they may no longer be available from `@apollo/client`. <br/>
  [@hwillson](https://github.com/hwillson) in [#5437](https://github.com/apollographql/apollo-client/pull/5437) and [#5514](https://github.com/apollographql/apollo-client/pull/5514)

  > Utilities that were previously externally available through the `apollo-utilities` package are now only available by importing from `@apollo/client/utilities`. <br/> > [@hwillson](https://github.com/hwillson) in [#5683](https://github.com/apollographql/apollo-client/pull/5683)

- Make sure all `graphql-tag` public exports are re-exported. <br/>
  [@hwillson](https://github.com/hwillson) in [#5861](https://github.com/apollographql/apollo-client/pull/5861)

- Fully removed `prettier`. The Apollo Client team has decided to no longer automatically enforce code formatting across the codebase. In most cases existing code styles should be followed as much as possible, but this is not a hard and fast rule. <br/>
  [@hwillson](https://github.com/hwillson) in [#5227](https://github.com/apollographql/apollo-client/pull/5227)

- Make sure `ApolloContext` plays nicely with IE11 when storing the shared context. <br/>
  [@ms](https://github.com/ms) in [#5840](https://github.com/apollographql/apollo-client/pull/5840)

- Migrated React Apollo HOC and Components functionality into Apollo Client, making it accessible from `@apollo/client/react/components` and `@apollo/client/react/hoc` entry points. <br/>
  [@hwillson](https://github.com/hwillson) in [#6558](https://github.com/apollographql/apollo-client/pull/6558)

- Support passing a `context` object through the link execution chain when using subscriptions. <br/>
  [@sgtpepper43](https://github.com/sgtpepper43) in [#4925](https://github.com/apollographql/apollo-client/pull/4925)

- `MockSubscriptionLink` now supports multiple subscriptions. <br/>
  [@dfrankland](https://github.com/dfrankland) in [#6081](https://github.com/apollographql/apollo-client/pull/6081)

### Bug Fixes

- `useMutation` adjustments to help avoid an infinite loop / too many renders issue, caused by unintentionally modifying the `useState` based mutation result directly. <br/>
  [@hwillson](https://github/com/hwillson) in [#5770](https://github.com/apollographql/apollo-client/pull/5770)

- Missing `__typename` fields no longer cause the `InMemoryCache#diff` result to be marked `complete: false`, if those fields were added by `InMemoryCache#transformDocument` (which calls `addTypenameToDocument`). <br/>
  [@benjamn](https://github.com/benjamn) in [#5787](https://github.com/apollographql/apollo-client/pull/5787)

- Fixed an issue that allowed `@client @export` based queries to lead to extra unnecessary network requests being fired. <br/>
  [@hwillson](https://github.com/hwillson) in [#5946](https://github.com/apollographql/apollo-client/pull/5946)

- Refined `useLazyQuery` types to help prevent runtime errors. <br/>
  [@benmosher](https://github.com/benmosher) in [#5935](https://github.com/apollographql/apollo-client/pull/5935)

- Make sure `@client @export` variables used in watched queries are updated each time the query receives new data that changes the value of the `@export` variable. <br/>
  [@hwillson](https://github.com/hwillson) in [#5986](https://github.com/apollographql/apollo-client/pull/5986)

- Ensure `useMutation` passes a defined `errorPolicy` option into its underlying `ApolloClient.mutate()` call. <br/>
  [@jamesreggio](https://github.com/jamesreggio) in [#5863](https://github.com/apollographql/apollo-client/pull/5863)

- `useQuery`: Prevent new data re-render attempts during an existing render. This helps avoid React 16.13.0's "Cannot update a component from inside the function body of a different component" warning (https://github.com/facebook/react/pull/17099). <br/>
  [@hwillson](https://github.com/hwillson) in [#6107](https://github.com/apollographql/apollo-client/pull/6107)

- Expand `ApolloError` typings to include `ServerError` and `ServerParseError`. <br/>
  [@dmarkow](https://github.com/dmarkow) in [#6319](https://github.com/apollographql/apollo-client/pull/6319)

- Fast responses received over the link chain will no longer conflict with `skip` settings. <br/>
  [@hwillson](https://github.com/hwillson) in [#6587](https://github.com/apollographql/apollo-client/pull/6587)

## Apollo Client 2.6.8

### Apollo Client (2.6.8)

- Update the `fetchMore` type signature to accept `context`. <br/>
  [@koenpunt](https://github.com/koenpunt) in [#5147](https://github.com/apollographql/apollo-client/pull/5147)

- Fix type for `Resolver` and use it in the definition of `Resolvers`. <br />
  [@peoplenarthax](https://github.com/peoplenarthax) in [#4943](https://github.com/apollographql/apollo-client/pull/4943)

- Local state resolver functions now receive a `fragmentMap: FragmentMap`
  object, in addition to the `field: FieldNode` object, via the `info`
  parameter. <br/>
  [@mjlyons](https://github.com/mjlyons) in [#5388](https://github.com/apollographql/apollo-client/pull/5388)

- Documentation updates. <br/>
  [@tomquirk](https://github.com/tomquirk) in [#5645](https://github.com/apollographql/apollo-client/pull/5645) <br/>
  [@Sequoia](https://github.com/Sequoia) in [#5641](https://github.com/apollographql/apollo-client/pull/5641) <br/>
  [@phryneas](https://github.com/phryneas) in [#5628](https://github.com/apollographql/apollo-client/pull/5628) <br/>
  [@AryanJ-NYC](https://github.com/AryanJ-NYC) in [#5560](https://github.com/apollographql/apollo-client/pull/5560)

### GraphQL Anywhere (4.2.6)

- Fix `filter` edge case involving `null`. <br/>
  [@lifeiscontent](https://github.com/lifeiscontent) in [#5110](https://github.com/apollographql/apollo-client/pull/5110)

### Apollo Boost (0.4.7)

- Replace `GlobalFetch` reference with `WindowOrWorkerGlobalScope`. <br/>
  [@abdonrd](https://github.com/abdonrd) in [#5373](https://github.com/apollographql/apollo-client/pull/5373)

- Add `assumeImmutableResults` typing to apollo boost `PresetConfig` interface. <br/>
  [@bencoullie](https://github.com/bencoullie) in [#5571](https://github.com/apollographql/apollo-client/pull/5571)

## Apollo Client (2.6.4)

### Apollo Client (2.6.4)

- Modify `ObservableQuery` to allow queries with `notifyOnNetworkStatusChange`
  to be notified when loading after an error occurs. <br />
  [@jasonpaulos](https://github.com/jasonpaulos) in [#4992](https://github.com/apollographql/apollo-client/pull/4992)

- Add `graphql` as a `peerDependency` of `apollo-cache` and
  `graphql-anywhere`. <br/>
  [@ssalbdivad](https://github.com/ssalbdivad) in [#5081](https://github.com/apollographql/apollo-client/pull/5081)

- Documentation updates. </br>
  [@raibima](https://github.com/raibima) in [#5132](https://github.com/apollographql/apollo-client/pull/5132) <br/>
  [@hwillson](https://github.com/hwillson) in [#5141](https://github.com/apollographql/apollo-client/pull/5141)

## Apollo Client (2.6.3)

### Apollo Client (2.6.3)

- A new `ObservableQuery.resetQueryStoreErrors()` method is now available that
  can be used to clear out `ObservableQuery` query store errors. <br/>
  [@hwillson](https://github.com/hwillson) in [#4941](https://github.com/apollographql/apollo-client/pull/4941)
- Documentation updates. <br/>
  [@michael-watson](https://github.com/michael-watson) in [#4940](https://github.com/apollographql/apollo-client/pull/4940) <br/>
  [@hwillson](https://github.com/hwillson) in [#4969](https://github.com/apollographql/apollo-client/pull/4969)

## Apollo Client (2.6.1)

### Apollo Utilities 1.3.2

- Reimplement `isEqual` without pulling in massive `lodash.isequal`. <br/>
  [@benjamn](https://github.com/benjamn) in [#4924](https://github.com/apollographql/apollo-client/pull/4924)

## Apollo Client (2.6.1)

- In all Apollo Client packages, the compilation of `lib/bundle.esm.js` to `lib/bundle.cjs.js` and `lib/bundle.umd.js` now uses Babel instead of Rollup, since Babel correctly compiles some [edge cases](https://github.com/apollographql/apollo-client/issues/4843#issuecomment-495717720) that neither Rollup nor TypeScript compile correctly. <br/>
  [@benjamn](https://github.com/benjamn) in [#4911](https://github.com/apollographql/apollo-client/pull/4911)

### Apollo Cache In-Memory 1.6.1

- Pretend that `__typename` exists on the root Query when matching fragments. <br/>
  [@benjamn](https://github.com/benjamn) in [#4853](https://github.com/apollographql/apollo-client/pull/4853)

### Apollo Utilities 1.3.1

- The `isEqual` function has been reimplemented using the `lodash.isequal` npm package, to better support circular references. Since the `lodash.isequal` package is already used by `react-apollo`, this change is likely to decrease total bundle size. <br/>
  [@capaj](https://github.com/capaj) in [#4915](https://github.com/apollographql/apollo-client/pull/4915)

## Apollo Client (2.6.0)

- In production, `invariant(condition, message)` failures will now include
  a unique error code that can be used to trace the error back to the
  point of failure. <br/>
  [@benjamn](https://github.com/benjamn) in [#4521](https://github.com/apollographql/apollo-client/pull/4521)

### Apollo Client 2.6.0

- If you can be sure your application code does not modify cache result objects (see `freezeResults` note below), you can unlock substantial performance improvements by communicating this assumption via

  ```ts
  new ApolloClient({ assumeImmutableResults: true });
  ```

  which allows the client to avoid taking defensive snapshots of past results using `cloneDeep`, as explained by [@benjamn](https://github.com/benjamn) in [#4543](https://github.com/apollographql/apollo-client/pull/4543).

- Identical overlapping queries are now deduplicated internally by `apollo-client`, rather than using the `apollo-link-dedup` package. <br/>
  [@benjamn](https://github.com/benjamn) in commit [7cd8479f](https://github.com/apollographql/apollo-client/pull/4586/commits/7cd8479f27ce38930f122e4f703c4081a75a63a7)

- The `FetchPolicy` type has been split into two types, so that passing `cache-and-network` to `ApolloClient#query` is now forbidden at the type level, whereas previously it was forbidden by a runtime `invariant` assertion:

  ```ts
  export type FetchPolicy =
    | "cache-first"
    | "network-only"
    | "cache-only"
    | "no-cache"
    | "standby";

  export type WatchQueryFetchPolicy = FetchPolicy | "cache-and-network";
  ```

  The exception thrown if you ignore the type error has also been improved to explain the motivation behind this restriction. <br/>
  [Issue #3130 (comment)](https://github.com/apollographql/apollo-client/issues/3130#issuecomment-478409066) and commit [cf069bc7](github.com/apollographql/apollo-client/commit/cf069bc7ee6577092234b0eb0ac32e05d50f5a1c)

- Avoid updating (and later invalidating) cache watches when `fetchPolicy` is `'no-cache'`. <br/>
  [@bradleyayers](https://github.com/bradleyayers) in [PR #4573](https://github.com/apollographql/apollo-client/pull/4573), part of [issue #3452](https://github.com/apollographql/apollo-client/issues/3452)

- Remove temporary `queryId` after `fetchMore` completes. <br/>
  [@doomsower](https://github.com/doomsower) in [#4440](https://github.com/apollographql/apollo-client/pull/4440)

- Call `clearStore` callbacks after clearing store. <br/>
  [@ds8k](https://github.com/ds8k) in [#4695](https://github.com/apollographql/apollo-client/pull/4695)

- Perform all `DocumentNode` transforms once, and cache the results. <br/>
  [@benjamn](https://github.com/benjamn) in [#4601](https://github.com/apollographql/apollo-client/pull/4601)

- Accommodate `@client @export` variable changes in `ObservableQuery`. <br/>
  [@hwillson](https://github.com/hwillson) in [#4604](https://github.com/apollographql/apollo-client/pull/4604)

- Support the `returnPartialData` option for watched queries again. <br/>
  [@benjamn](https://github.com/benjamn) in [#4743](https://github.com/apollographql/apollo-client/pull/4743)

- Preserve `networkStatus` for incomplete `cache-and-network` queries. <br/>
  [@benjamn](https://github.com/benjamn) in [#4765](https://github.com/apollographql/apollo-client/pull/4765)

- Preserve `cache-and-network` `fetchPolicy` when refetching. <br/>
  [@benjamn](https://github.com/benjamn) in [#4840](https://github.com/apollographql/apollo-client/pull/4840)

- Update the React Native docs to remove the request for external example apps that we can link to. We're no longer going to manage a list of external example apps. <br />
  [@hwillson](https://github.com/hwillson) in [#4531](https://github.com/apollographql/apollo-client/pull/4531)

- Polling queries are no longer batched together, so their scheduling should be more predictable. <br/>
  [@benjamn](https://github.com/benjamn) in [#4800](https://github.com/apollographql/apollo-client/pull/4800)

### Apollo Cache In-Memory 1.6.0

- Support `new InMemoryCache({ freezeResults: true })` to help enforce immutability. <br/>
  [@benjamn](https://github.com/benjamn) in [#4514](https://github.com/apollographql/apollo-client/pull/4514)

- Allow `IntrospectionFragmentMatcher` to match fragments against the root `Query`, as `HeuristicFragmentMatcher` does. <br/>
  [@rynobax](https://github.com/rynobax) in [#4620](https://github.com/apollographql/apollo-client/pull/4620)

- Rerential identity (`===`) of arrays in cache results will now be preserved for unchanged data. <br/>
  [@benjamn](https://github.com/benjamn) in commit [f3091d6a](https://github.com/apollographql/apollo-client/pull/4586/commits/f3091d6a7e91be98549baea58903282cc540f460)

- Avoid adding `__typename` field to `@client` selection sets that have been `@export`ed as input variables. <br/>
  [@benjamn](https://github.com/benjamn) in [#4784](https://github.com/apollographql/apollo-client/pull/4784)

### GraphQL Anywhere 4.2.2

- The `graphql` function can now be configured to ignore `@include` and
  `@skip` directives (useful when walking a fragment to generate prop types
  or filter result data). <br/>
  [@GreenGremlin](https://github.com/GreenGremlin) in [#4373](https://github.com/apollographql/apollo-client/pull/4373)

## Apollo Client 2.5.1

### apollo-client 2.5.1

- Fixes `A tuple type element list cannot be empty` issue. <br/>
  [@benjamn](https://github.com/benjamn) in [#4502](https://github.com/apollographql/apollo-client/pull/4502)

### graphql-anywhere 4.2.1

- Adds back the missing `graphql-anywhere/lib/async` entry point. <br/>
  [@benjamn](https://github.com/benjamn) in [#4503](https://github.com/apollographql/apollo-client/pull/4503)

## Apollo Client (2.5.0)

### Apollo Client (2.5.0)

- Introduces new local state management features (client-side schema
  and local resolver / `@client` support) and many overall code improvements,
  to help reduce the Apollo Client bundle size. <br/>
  [#4361](https://github.com/apollographql/apollo-client/pull/4361)
- Revamped CJS and ESM bundling approach with Rollup. <br/>
  [@rosskevin](https://github.com/rosskevin) in [#4261](https://github.com/apollographql/apollo-client/pull/4261)
- Fixes an issue where the `QueryManager` was accidentally returning cached
  data for `network-only` queries. <br/>
  [@danilobuerger](https://github.com/danilobuerger) in [#4352](https://github.com/apollographql/apollo-client/pull/4352)
- Fixed an issue in the repo `.gitattributes` that was causing binary files
  to have their line endings adjusted, and cleaned up corrupted documentation
  images (ref: https://github.com/apollographql/apollo-client/pull/4232). <br/>
  [@rajington](https://github.com/rajington) in [#4438](https://github.com/apollographql/apollo-client/pull/4438)
- Improve (and shorten) query polling implementation. <br/>
  [PR #4337](https://github.com/apollographql/apollo-client/pull/4337)

## Apollo Client (2.4.13)

### Apollo Client (2.4.13)

- Resolve "invalidate" -> "invalidated" typo in `QueryManager`. <br/>
  [@quazzie](https://github.com/quazzie) in [#4041](https://github.com/apollographql/apollo-client/pull/4041)

- Properly type `setQuery` and fix now typed callers. <br/>
  [@danilobuerger](https://github.com/danilobuerger) in [#4369](https://github.com/apollographql/apollo-client/pull/4369)

- Align with the React Apollo decision that result `data` should be
  `TData | undefined` instead of `TData | {}`. <br/>
  [@danilobuerger](https://github.com/danilobuerger) in [#4356](https://github.com/apollographql/apollo-client/pull/4356)

- Documentation updates. <br/>
  [@danilobuerger](https://github.com/danilobuerger) in [#4340](https://github.com/apollographql/apollo-client/pull/4340) <br />
  [@justyn-clark](https://github.com/justyn-clark) in [#4383](https://github.com/apollographql/apollo-client/pull/4383) <br />
  [@jtassin](https://github.com/jtassin) in [#4287](https://github.com/apollographql/apollo-client/pull/4287) <br />
  [@Gongreg](https://github.com/Gongreg) in [#4386](https://github.com/apollographql/apollo-client/pull/4386) <br />
  [@davecardwell](https://github.com/davecardwell) in [#4399](https://github.com/apollographql/apollo-client/pull/4399) <br />
  [@michaelknoch](https://github.com/michaelknoch) in [#4384](https://github.com/apollographql/apollo-client/pull/4384) <br />

## Apollo Client (2.4.12)

### Apollo Client (2.4.12)

- Support `ApolloClient#stop` method for safe client disposal. <br/>
  [PR #4336](https://github.com/apollographql/apollo-client/pull/4336)

## Apollo Client (2.4.11)

- Added explicit dependencies on the
  [`tslib`](https://www.npmjs.com/package/tslib) package to all client
  packages to fix
  [Issue #4332](https://github.com/apollographql/apollo-client/issues/4332).

### Apollo Client (2.4.11)

- Reverted some breaking changes accidentally released in a patch version
  (2.4.10). [PR #4334](https://github.com/apollographql/apollo-client/pull/4334)

## Apollo Client (2.4.10)

### Apollo Client (2.4.10)

- The `apollo-client` package no longer exports a `printAST` function from
  `graphql/language/printer`. If you need this functionality, import it
  directly: `import { print } from "graphql/language/printer"`

- Query polling now uses a simpler scheduling strategy based on a single
  `setTimeout` interval rather than multiple `setInterval` timers. The new
  timer fires at the rate of the fastest polling interval, and queries
  with longer polling intervals fire whenever the time elapsed since they
  last fired exceeds their desired interval. <br/>
  [PR #4243](https://github.com/apollographql/apollo-client/pull/4243)

### Apollo Cache In-Memory (1.4.1)

- The `optimism` npm package has been updated to a version (0.6.9) that
  provides its own TypeScript declarations, which should fix problems like
  [Issue #4327](https://github.com/apollographql/apollo-client/issues/4327). <br/>
  [PR #4331](https://github.com/apollographql/apollo-client/pull/4331)

- Error messages involving GraphQL queries now print the queries using
  `JSON.stringify` instead of the `print` function exported by the
  `graphql` package, to avoid pulling unnecessary printing logic into your
  JavaScript bundle. <br/>
  [PR #4234](https://github.com/apollographql/apollo-client/pull/4234)

- The `QueryKeyMaker` abstraction has been removed, meaning that cache
  results for non-identical queries (or sub-queries) with equivalent
  structure will no longer be cached together. This feature was a nice
  optimization in certain specific use cases, but it was not worth the
  additional complexity or bundle size. <br/>
  [PR #4245](https://github.com/apollographql/apollo-client/pull/4245)

### Apollo Utilities (1.1.1)

- The `flattenSelections` helper function is no longer exported from
  `apollo-utilities`, since `getDirectiveNames` has been reimplemented
  without using `flattenSelections`, and `flattenSelections` has no clear
  purpose now. If you need the old functionality, use a visitor:

  ```ts
  import { visit } from "graphql/language/visitor";

  function flattenSelections(selection: SelectionNode) {
    const selections: SelectionNode[] = [];
    visit(selection, {
      SelectionSet(ss) {
        selections.push(...ss.selections);
      },
    });
    return selections;
  }
  ```

## Apollo Client (2.4.9)

### Apollo Client (2.4.9)

- Apollo Client has been updated to use `graphql` 14.x as a dev dependency. <br/>
  [@hwillson](https://github.com/hwillson) in [#4233](https://github.com/apollographql/apollo-client/pull/4233)

- The `onClearStore` function can now be used to register callbacks that should
  be triggered when calling `clearStore`. <br/>
  [@joe-re](https://github.com/joe-re) in [#4082](https://github.com/apollographql/apollo-client/pull/4082)

- Make `isApolloError` available for external use. <br/>
  [@FredyC](https://github.com/FredyC) in [#4223](https://github.com/apollographql/apollo-client/pull/4223)

- The `QueryManager` now calls `complete` on the observables used by
  Apollo Client's Subscription handling. This gives finite subscriptions a
  chance to handle cleanup. <br/>
  [@sujeetsr](https://github.com/sujeetsr) in [#4290](https://github.com/apollographql/apollo-client/pull/4290)

- Documentation updates. <br/>
  [@lifedup](https://github.com/lifedup) in [#3931](https://github.com/apollographql/apollo-client/pull/3931) <br />
  [@Dem0n3D](https://github.com/Dem0n3D) in [#4008](https://github.com/apollographql/apollo-client/pull/4008) <br />
  [@anand-sundaram-zocdoc](https://github.com/anand-sundaram-zocdoc) in [#4009](https://github.com/apollographql/apollo-client/pull/4009) <br />
  [@mattphoto](https://github.com/mattphoto) in [#4026](https://github.com/apollographql/apollo-client/pull/4026) <br />
  [@birge](https://github.com/birge) in [#4029](https://github.com/apollographql/apollo-client/pull/4029) <br />
  [@mxstbr](https://github.com/mxstbr) in [#4127](https://github.com/apollographql/apollo-client/pull/4127) <br/>
  [@Caerbannog](https://github.com/Caerbannog) in [#4140](https://github.com/apollographql/apollo-client/pull/4140) <br/>
  [@jedwards1211](https://github.com/jedwards1211) in [#4179](https://github.com/apollographql/apollo-client/pull/4179) <br/>
  [@nutboltu](https://github.com/nutboltu) in [#4182](https://github.com/apollographql/apollo-client/pull/4182) <br/>
  [@CarloPalinckx](https://github.com/CarloPalinckx) in [#4189](https://github.com/apollographql/apollo-client/pull/4189) <br/>
  [@joebernard](https://github.com/joebernard) in [#4206](https://github.com/apollographql/apollo-client/pull/4206) <br/>
  [@evans](https://github.com/evans) in [#4213](https://github.com/apollographql/apollo-client/pull/4213) <br/>
  [@danilobuerger](https://github.com/danilobuerger) in [#4214](https://github.com/apollographql/apollo-client/pull/4214) <br/>
  [@stubailo](https://github.com/stubailo) in [#4220](https://github.com/apollographql/apollo-client/pull/4220) <br/>
  [@haysclark](https://github.com/haysclark) in [#4255](https://github.com/apollographql/apollo-client/pull/4255) <br/>
  [@shelmire](https://github.com/shelmire) in [#4266](https://github.com/apollographql/apollo-client/pull/4266) <br/>
  [@peggyrayzis](https://github.com/peggyrayzis) in [#4280](https://github.com/apollographql/apollo-client/pull/4280) <br/>
  [@caydie-tran](https://github.com/caydie-tran) in [#4300](https://github.com/apollographql/apollo-client/pull/4300)

### Apollo Utilities (1.1.0)

- Transformation utilities have been refactored to work with `graphql` 14.x.
  GraphQL AST's are no longer being directly modified. <br/>
  [@hwillson](https://github.com/hwillson) in [#4233](https://github.com/apollographql/apollo-client/pull/4233)

### Apollo Cache In-Memory (1.4.0)

- The speed and memory usage of optimistic reads and writes has been
  improved dramatically using a new layering technique that does not
  require copying the non-optimistic contents of the cache. <br/>
  [PR #4319](https://github.com/apollographql/apollo-client/pull/4319/)

- The `RecordingCache` abstraction has been removed, and thus is no longer
  exported from `apollo-cache-inmemory`. <br/>
  [PR #4319](https://github.com/apollographql/apollo-client/pull/4319/)

- Export the optimism `wrap` function using ES2015 export syntax, instead of
  CommonJS. <br/>
  [@ardatan](https://github.com/ardatan) in [#4158](https://github.com/apollographql/apollo-client/pull/4158)

## Apollo Client (2.4.8)

### Apollo Client (2.4.8)

- Documentation and config updates. <br/>
  [@justinanastos](https://github.com/justinanastos) in [#4187](https://github.com/apollographql/apollo-client/pull/4187) <br/>
  [@PowerKiKi](https://github.com/PowerKiKi) in [#3693](https://github.com/apollographql/apollo-client/pull/3693) <br/>
  [@nandito](https://github.com/nandito) in [#3865](https://github.com/apollographql/apollo-client/pull/3865)

- Schema/AST tranformation utilities have been updated to work properly with
  `@client` directives. <br/>
  [@justinmakaila](https://github.com/justinmakaila) in [#3482](https://github.com/apollographql/apollo-client/pull/3482)

### Apollo Cache In-Memory (1.3.12)

- Avoid using `DepTrackingCache` for optimistic reads.
  [PR #4521](https://github.com/apollographql/apollo-client/pull/4251)

- When creating an `InMemoryCache` object, it's now possible to disable the
  result caching behavior introduced in [#3394](https://github.com/apollographql/apollo-client/pull/3394),
  either for diagnostic purposes or because the benefit of caching repeated
  reads is not worth the extra memory usage in your application:
  ```ts
  new InMemoryCache({
    resultCaching: false,
  });
  ```
  Part of [PR #4521](https://github.com/apollographql/apollo-client/pull/4251).

## Apollo Client (2.4.7)

### Apollo Client (2.4.7)

- The `ApolloClient` constructor has been updated to accept `name` and
  `version` params, that can be used to support Apollo Server [Client Awareness](https://www.apollographql.com/docs/apollo-server/v2/features/metrics.html#Client-Awareness)
  functionality. These client awareness properties are passed into the
  defined Apollo Link chain, and are then ultimately sent out as custom
  headers with outgoing requests. <br/>
  [@hwillson](https://github.com/hwillson) in [#4154](https://github.com/apollographql/apollo-client/pull/4154)

### Apollo Boost (0.1.22)

- No changes.

### Apollo Cache (1.1.21)

- No changes.

### Apollo Cache In-Memory (1.3.11)

- No changes.

### Apollo Utilities (1.0.26)

- No changes.

### Graphql Anywhere (4.1.23)

- No changes.

## Apollo Client (2.4.6)

### Apollo Cache In-Memory (1.3.10)

- Added some `return`s to prevent errors with `noImplicitReturns`
  TypeScript rule.
  [PR #4137](https://github.com/apollographql/apollo-client/pull/4137)

- Exclude the `src/` directory when publishing `apollo-cache-inmemory`.
  [Issue #4083](https://github.com/apollographql/apollo-client/issues/4083)

## Apollo Client (2.4.5)

- Optimistic tests cleanup.
  [PR #3834](https://github.com/apollographql/apollo-client/pull/3834) by
  [@joshribakoff](https://github.com/joshribakoff)

- Documentation updates.
  [PR #3840](https://github.com/apollographql/apollo-client/pull/3840) by
  [@chentsulin](https://github.com/chentsulin) and
  [PR #3844](https://github.com/apollographql/apollo-client/pull/3844) by
  [@lorensr](https://github.com/lorensr)

- Implement `ObservableQuery#isDifferentFromLastResult` to fix
  [Issue #4054](https://github.com/apollographql/apollo-client/issues/4054) and
  [Issue #4031](https://github.com/apollographql/apollo-client/issues/4031).
  [PR #4069](https://github.com/apollographql/apollo-client/pull/4069)

### Apollo Cache (1.1.20)

- Add `readQuery` test to make sure options aren't mutated.
  [@CarloPalinckx](https://github.com/CarloPalinckx) in
  [#3838](https://github.com/apollographql/apollo-client/pull/3838)

### Apollo Cache In-Memory (1.3.9)

- Avoid modifying source objects when merging cache results.
  [Issue #4081](https://github.com/apollographql/apollo-client/issues/4081)
  [PR #4089](https://github.com/apollographql/apollo-client/pull/4089)

### Apollo Utilities (1.0.25)

- Fix `apollo-utilities` `isEqual` bug due to missing `hasOwnProperty`
  check. [PR #4072](https://github.com/apollographql/apollo-client/pull/4072)
  by [@samkline](https://github.com/samkline)

## Apollo Client (2.4.4)

### Apollo Utilities (1.0.24)

- Discard property accessor functions in `cloneDeep` helper, to fix
  [issue #4034](https://github.com/apollographql/apollo-client/issues/4034).

- Unconditionally remove `cloneDeep` property accessors.
  [PR #4039](https://github.com/apollographql/apollo-client/pull/4039)

- Avoid copying non-enumerable and/or `Symbol` keys in `cloneDeep`.
  [PR #4052](https://github.com/apollographql/apollo-client/pull/4052)

### Apollo Cache In-Memory (1.3.7)

- Throw when querying non-scalar objects without a selection set.
  [Issue #4025](https://github.com/apollographql/apollo-client/issues/4025)
  [PR #4038](https://github.com/apollographql/apollo-client/pull/4038)

- Work around spec non-compliance of `Map#set` and `Set#add` in IE11.
  [Issue #4024](https://github.com/apollographql/apollo-client/issues/4024)
  [PR #4012](https://github.com/apollographql/apollo-client/pull/4012)

## Apollo Client (2.4.3)

- Add additional checks to make sure we don't try to set the network status
  of queries in the store, when the store doesn't exist. <br/>
  [@i6mi6](https://github.com/i6mi6) in [#3914](https://github.com/apollographql/apollo-client/pull/3914)
- Documentation updates. <br/>
  [@shanonvl](https://github.com/shanonvl) in [#3925](https://github.com/apollographql/apollo-client/pull/3925) <br/>
  [@ojh102](https://github.com/ojh102) in [#3920](https://github.com/apollographql/apollo-client/pull/3920) <br/>
  [@Bkucera](https://github.com/Bkucera) in [#3919](https://github.com/apollographql/apollo-client/pull/3919) <br/>
  [@j4chou](https://github.com/j4chou) in [#3915](https://github.com/apollographql/apollo-client/pull/3915) <br/>
  [@billfienberg](https://github.com/billfienberg) in [#3886](https://github.com/apollographql/apollo-client/pull/3886) <br/>
  [@TLadd](https://github.com/TLadd) in [#3884](https://github.com/apollographql/apollo-client/pull/3884)

- The `ObservableQuery` class now makes a deep clone of `lastResult` when
  first received, so that the `isDifferentResult` logic will not be
  confused if the result object is modified later.
  [Issue #3992](https://github.com/apollographql/apollo-client/issues/3992)
  [PR #4032](https://github.com/apollographql/apollo-client/pull/4032/commits/e66027c5341dc7aaf71ee7ffcba1305b9a553525)

### Apollo Cache In-Memory (1.3.6)

- Optimize repeated `apollo-cache-inmemory` reads by caching partial query
  results, for substantial performance improvements. As a consequence, watched
  queries will not be rebroadcast unless the data have changed.
  [PR #3394](https://github.com/apollographql/apollo-client/pull/3394)

- Include root ID and fragment matcher function in cache keys computed by
  `StoreReader#executeStoreQuery` and `executeSelectionSet`, and work
  around bugs in the React Native `Map` and `Set` polyfills.
  [PR #3964](https://github.com/apollographql/apollo-client/pull/3964)
  [React Native PR #21492 (pending)](https://github.com/facebook/react-native/pull/21492)

- The `apollo-cache-inmemory` package now allows `graphql@^14.0.0` as a
  peer dependency.
  [Issue #3978](https://github.com/apollographql/apollo-client/issues/3978)

- The `apollo-cache-inmemory` package now correctly broadcasts changes
  even when the new data is `===` to the old data, since the contents of
  the data object may have changed.
  [Issue #3992](https://github.com/apollographql/apollo-client/issues/3992)
  [PR #4032](https://github.com/apollographql/apollo-client/pull/4032/commits/d6a673fbc1444e115e90cc9e4c7fa3fc67bb7e56)

### Apollo GraphQL Anywhere (4.1.20)

- Make `graphql-anywhere` `filter` function generic (typescript). <br/>
  [@minznerjosh](https://github.com/minznerjosh) in [#3929](https://github.com/apollographql/apollo-client/pull/3929)

### Apollo Utilities (1.0.22)

- The `fclone` package has been replaced with a custom `cloneDeep`
  implementation that is tolerant of cycles, symbol properties, and
  non-enumerable properties.
  [PR #4032](https://github.com/apollographql/apollo-client/pull/4032/commits/78e2ad89f950da2829f49c7876f968adb2bc1302)

### Apollo Boost (0.1.17)

- Remove duplicate InMemoryCache export for Babel 6 compatibility.
  [Issue #3910](https://github.com/apollographql/apollo-client/issues/3910)
  [PR #3932](https://github.com/apollographql/apollo-client/pull/3932)

### Apollo Cache (1.1.18)

- No changes.

## Apollo Client (2.4.2)

### Apollo Client (2.4.2)

- Apollo Client no longer deep freezes query results.
  [@hwillson](https://github.com/hwillson) in [#3883](https://github.com/apollographql/apollo-client/pull/3883)
- A new `clearStore` method has been added, that will remove all data from
  the store. Unlike `resetStore`, it will not refetch active queries after
  removing store data.
  [@hwillson](https://github.com/hwillson) in [#3885](https://github.com/apollographql/apollo-client/pull/3885)

### Apollo Utilities (1.0.21)

- Replace the custom `cloneDeep` implementation with
  [`fclone`](https://www.npmjs.com/package/fclone), to avoid crashing when
  encountering circular references. <br/>
  [@hwillson](https://github.com/hwillson) in [#3881](https://github.com/apollographql/apollo-client/pull/3881)

### Apollo Boost (0.1.16)

- No changes.

### Apollo Cache (1.1.17)

- No changes.

### Apollo Cache In-Memory (1.2.10)

- No changes.

### Apollo GraphQL Anywhere (4.1.19)

- No changes.

## 2.4.1 (August 26, 2018)

### Apollo Client (2.4.1)

- `mutate`'s `refetchQueries` option now allows queries to include a custom
  `context` option. This `context` will be used when refetching the query.
  For example:

  ```js
  context = {
    headers: {
      token: 'some auth token',
    },
  };
  client.mutate({
    mutation: UPDATE_CUSTOMER_MUTATION,
    variables: {
      userId: user.id,
      firstName,
      ...
    },
    refetchQueries: [{
      query: CUSTOMER_MESSAGES_QUERY,
      variables: { userId: user.id },
      context,
    }],
    context,
  });
  ```

  The `CUSTOMER_MESSAGES_QUERY` above will be refetched using `context`.
  Normally queries are refetched using the original context they were first
  started with, but this provides a way to override the context, if needed. <br/>
  [@hwillson](https://github.com/hwillson) in [#3852](https://github.com/apollographql/apollo-client/pull/3852)

- Documentation updates. <br/>
  [@hwillson](https://github.com/hwillson) in [#3841](https://github.com/apollographql/apollo-client/pull/3841)

### Apollo Boost (0.1.15)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

### Apollo Cache (1.1.16)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

### Apollo Cache In-Memory (1.2.9)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

### Apollo Utilities (1.0.20)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

### Apollo GraphQL Anywhere (4.1.18)

- Various internal infrastructure changes related to building, bundling,
  testing, etc.
  [@hwillson](https://github.com/hwillson) in [#3817](https://github.com/apollographql/apollo-client/pull/3817)

## 2.4.0 (August 17, 2018)

### Apollo Client (2.4.0)

- Add proper error handling for subscriptions. If you have defined an `error`
  handler on your subscription observer, it will now be called when an error
  comes back in a result, and the `next` handler will be skipped (similar to
  how we're handling errors with mutations). Previously, the error was
  just passed in the result to the `next` handler. If you don't have an
  `error` handler defined, the previous functionality is maintained, meaning
  the error is passed in the result, giving the next handler a chance to deal
  with it. This should help address backwards compatibility (and is the reason
  for the minor version bumo in this release). <br/>
  [@clayne11](https://github.com/clayne11) in [#3800](https://github.com/apollographql/apollo-client/pull/3800)
- Allow an `optimistic` param to be passed into `ApolloClient.readQuery` and
  `ApolloClient.readFragment`, that when set to `true`, will allow
  optimistic results to be returned. Is `false` by default. <br/>
  [@jay1337](https://github.com/jay1337) in [#2429](https://github.com/apollographql/apollo-client/pull/2429)
- Optimistic tests cleanup. <br/>
  [@joshribakoff](https://github.com/joshribakoff) in [#3713](https://github.com/apollographql/apollo-client/pull/3713)
- Make sure each package has its own `.npmignore`, so they're taken into
  consideration when publishing via lerna. <br/>
  [@hwillson](https://github.com/hwillson) in [#3828](https://github.com/apollographql/apollo-client/pull/3828)
- Documentation updates. <br/>
  [@toolness](https://github.com/toolness) in [#3804](https://github.com/apollographql/apollo-client/pull/3804) <br/>
  [@pungggi](https://github.com/pungggi) in [#3798](https://github.com/apollographql/apollo-client/pull/3798) <br/>
  [@lorensr](https://github.com/lorensr) in [#3748](https://github.com/apollographql/apollo-client/pull/3748) <br/>
  [@joshribakoff](https://github.com/joshribakoff) in [#3730](https://github.com/apollographql/apollo-client/pull/3730) <br/>
  [@yalamber](https://github.com/yalamber) in [#3819](https://github.com/apollographql/apollo-client/pull/3819) <br/>
  [@pschreibs85](https://github.com/pschreibs85) in [#3812](https://github.com/apollographql/apollo-client/pull/3812) <br/>
  [@msreekm](https://github.com/msreekm) in [#3808](https://github.com/apollographql/apollo-client/pull/3808) <br/>
  [@kamaltmo](https://github.com/kamaltmo) in [#3806](https://github.com/apollographql/apollo-client/pull/3806) <br/>
  [@lorensr](https://github.com/lorensr) in [#3739](https://github.com/apollographql/apollo-client/pull/3739) <br/>
  [@brainkim](https://github.com/brainkim) in [#3680](https://github.com/apollographql/apollo-client/pull/3680)

### Apollo Cache In-Memory (1.2.8)

- Fix typo in `console.warn` regarding fragment matching error message. <br/>
  [@combizs](https://github.com/combizs) in [#3701](https://github.com/apollographql/apollo-client/pull/3701)

### Apollo Boost (0.1.14)

- No changes.

### Apollo Cache (1.1.15)

- No changes.

### Apollo Utilities (1.0.19)

- No changes.

### Apollo GraphQL Anywhere (4.1.17)

- No changes.

## 2.3.8 (August 9, 2018)

### Apollo Client (2.3.8)

- Adjusted the `graphql` peer dependency to cover explicit minor ranges.
  Since the ^ operator only covers any minor version if the major version
  is not 0 (since a major version of 0 is technically considered development by
  semver 2), the current ^0.11.0 || ^14.0.0 graphql range doesn't cover
  0.12._ or 0.13._. This fixes the `apollo-client@X has incorrect peer dependency "graphql@^0.11.0 || ^14.0.0"` errors that people might have
  seen using `graphql` 0.12.x or 0.13.x. <br/>
  [@hwillson](https://github.com/hwillson) in [#3746](https://github.com/apollographql/apollo-client/pull/3746)
- Document `setVariables` internal API status. <br/>
  [@PowerKiKi](https://github.com/PowerKiKi) in [#3692](https://github.com/apollographql/apollo-client/pull/3692)
- Corrected `ApolloClient.queryManager` typing as it may be `undefined`. <br/>
  [@danilobuerger](https://github.com/danilobuerger) in [#3661](https://github.com/apollographql/apollo-client/pull/3661)
- Make sure using a `no-cache` fetch policy with subscriptions prevents data
  from being cached. <br/>
  [@hwillson](https://github.com/hwillson) in [#3773](https://github.com/apollographql/apollo-client/pull/3773)
- Fixed an issue that sometimes caused empty query results, when using the
  `no-cache` fetch policy. <br/>
  [@hwillson](https://github.com/hwillson) in [#3777](https://github.com/apollographql/apollo-client/pull/3777)
- Documentation updates. <br/>
  [@hwillson](https://github.com/hwillson) in [#3750](https://github.com/apollographql/apollo-client/pull/3750) <br/>
  [@hwillson](https://github.com/hwillson) in [#3754](https://github.com/apollographql/apollo-client/pull/3754) <br/>
  [@TheMightyPenguin](https://github.com/TheMightyPenguin) in [#3725](https://github.com/apollographql/apollo-client/pull/3725) <br/>
  [@bennypowers](https://github.com/bennypowers) in [#3668](https://github.com/apollographql/apollo-client/pull/3668) <br/>
  [@hwillson](https://github.com/hwillson) in [#3762](https://github.com/apollographql/apollo-client/pull/3762) <br/>
  [@chentsulin](https://github.com/chentsulin) in [#3688](https://github.com/apollographql/apollo-client/pull/3688) <br/>
  [@chentsulin](https://github.com/chentsulin) in [#3687](https://github.com/apollographql/apollo-client/pull/3687) <br/>
  [@ardouglass](https://github.com/ardouglass) in [#3645](https://github.com/apollographql/apollo-client/pull/3645) <br/>
  [@hwillson](https://github.com/hwillson) in [#3764](https://github.com/apollographql/apollo-client/pull/3764) <br/>
  [@hwillson](https://github.com/hwillson) in [#3767](https://github.com/apollographql/apollo-client/pull/3767) <br/>
  [@hwillson](https://github.com/hwillson) in [#3774](https://github.com/apollographql/apollo-client/pull/3774) <br/>
  [@hwillson](https://github.com/hwillson) in [#3779](https://github.com/apollographql/apollo-client/pull/3779)

### Apollo Boost (0.1.13)

- No changes.

### Apollo Cache In-Memory (1.2.7)

- No changes.

### Apollo Cache (1.1.14)

- No changes.

### Apollo Utilities (1.0.18)

- No changes.

### Apollo GraphQL Anywhere (4.1.16)

- No changes.

## 2.3.7 (July 24, 2018)

### Apollo Client (2.3.7)

- Release 2.3.6 broke Typescript compilation. `QueryManager`'s
  `getQueryWithPreviousResult` method included an invalid `variables` return
  type in the auto-generated `core/QueryManager.d.ts` declaration file. The
  type definition had a locally referenced path, that appears to have been
  caused by the typescript compiler getting confused at compile/publish time.
  `getQueryWithPreviousResult` return types are now excplicity identified,
  which helps Typescript avoid the local type reference. For more details,
  see https://github.com/apollographql/apollo-client/issues/3729. <br/>
  [@hwillson](https://github.com/hwillson) in [#3731](https://github.com/apollographql/apollo-client/pull/3731)

### Apollo Boost (0.1.12)

- No changes.

## 2.3.6 (July 24, 2018)

### Apollo Client (2.3.6)

- Documentation updates. <br/>
  [@ananth99](https://github.com/ananth99) in [#3599](https://github.com/apollographql/apollo-client/pull/3599) <br/>
  [@hwillson](https://github.com/hwillson) in [#3635](https://github.com/apollographql/apollo-client/pull/3635) <br/>
  [@JakeDawkins](https://github.com/JakeDawkins) in [#3642](https://github.com/apollographql/apollo-client/pull/3642) <br/>
  [@hwillson](https://github.com/hwillson) in [#3644](https://github.com/apollographql/apollo-client/pull/3644) <br/>
  [@gbau](https://github.com/gbau) in [#3644](https://github.com/apollographql/apollo-client/pull/3600) <br/>
  [@chentsulin](https://github.com/chentsulin) in [#3608](https://github.com/apollographql/apollo-client/pull/3608) <br/>
  [@MikaelCarpenter](https://github.com/MikaelCarpenter) in [#3609](https://github.com/apollographql/apollo-client/pull/3609) <br/>
  [@Gamezpedia](https://github.com/Gamezpedia) in [#3612](https://github.com/apollographql/apollo-client/pull/3612) <br/>
  [@jinxac](https://github.com/jinxac) in [#3647](https://github.com/apollographql/apollo-client/pull/3647) <br/>
  [@abernix](https://github.com/abernix) in [#3705](https://github.com/apollographql/apollo-client/pull/3705) <br/>
  [@dandv](https://github.com/dandv) in [#3703](https://github.com/apollographql/apollo-client/pull/3703) <br/>
  [@hwillson](https://github.com/hwillson) in [#3580](https://github.com/apollographql/apollo-client/pull/3580) <br/>
- Updated `graphql` `peerDependencies` to handle 14.x versions. <br/>
  [@ivank](https://github.com/ivank) in [#3598](https://github.com/apollographql/apollo-client/pull/3598)
- Add optional generic type params for variables on low level methods. <br/>
  [@mvestergaard](https://github.com/mvestergaard) in [#3588](https://github.com/apollographql/apollo-client/pull/3588)
- Add a new `awaitRefetchQueries` config option to the Apollo Client
  `mutate` function, that when set to `true` will wait for all
  `refetchQueries` to be fully refetched, before resolving the mutation
  call. `awaitRefetchQueries` is `false` by default. <br/>
  [@jzimmek](https://github.com/jzimmek) in [#3169](https://github.com/apollographql/apollo-client/pull/3169)

### Apollo Boost (0.1.11)

- Allow `fetch` to be given as a configuration option to `ApolloBoost`. <br/>
  [@mbaranovski](https://github.com/mbaranovski) in [#3590](https://github.com/apollographql/apollo-client/pull/3590)
- The `apollo-boost` `ApolloClient` constructor now warns about unsupported
  options. <br/>
  [@quentin-](https://github.com/quentin-) in [#3551](https://github.com/apollographql/apollo-client/pull/3551)

### Apollo Cache (1.1.13)

- No changes.

### Apollo Cache In-Memory (1.2.6)

- Add `__typename` and `id` properties to `dataIdFromObject` parameter
  (typescript) <br/>
  [@jfurler](https://github.com/jfurler) in [#3641](https://github.com/apollographql/apollo-client/pull/3641)
- Fixed an issue caused by `dataIdFromObject` considering returned 0 values to
  be falsy, instead of being a valid ID, which lead to the store not being
  updated properly in some cases. <br/>
  [@hwillson](https://github.com/hwillson) in [#3711](https://github.com/apollographql/apollo-client/pull/3711)

### Apollo Utilities (1.0.17)

- No changes.

### Apollo GraphQL Anywhere (4.1.15)

- Add support for arrays to `graphql-anywhere`'s filter utility. <br/>
  [@jsweet314](https://github.com/jsweet314) in [#3591](https://github.com/apollographql/apollo-client/pull/3591)
- Fix `Cannot convert object to primitive value` error that was showing up
  when attempting to report a missing property on an object. <br/>
  [@benjie](https://github.com/benjie) in [#3618](https://github.com/apollographql/apollo-client/pull/3618)

## 2.3.5 (June 19, 2018)

### Apollo Client (2.3.5)

- Internal code formatting updates.
  - [@chentsulin](https://github.com/chentsulin) in [#3574](https://github.com/apollographql/apollo-client/pull/3574)
- Documentation updates.
  - [@andtos90](https://github.com/andtos90) in [#3596](https://github.com/apollographql/apollo-client/pull/3596)
  - [@serranoarevalo](https://github.com/serranoarevalo) in [#3554](https://github.com/apollographql/apollo-client/pull/3554)
  - [@cooperka](https://github.com/cooperka) in [#3594](https://github.com/apollographql/apollo-client/pull/3594)
  - [@pravdomil](https://github.com/pravdomil) in [#3587](https://github.com/apollographql/apollo-client/pull/3587)
  - [@excitement-engineer](https://github.com/excitement-engineer) in [#3309](https://github.com/apollographql/apollo-client/pull/3309)

### Apollo Boost (0.1.10)

- No changes.

### Apollo Cache (1.1.12)

- No changes.

### Apollo Cache In-Memory (1.2.5)

- No changes.

### Apollo Utilities (1.0.16)

- Removed unnecessary whitespace from error message.
  - [@mbaranovski](https://github.com/mbaranovski) in [#3593](https://github.com/apollographql/apollo-client/pull/3593)

### Apollo GraphQL Anywhere (4.1.14)

- No changes.

## 2.3.4 (June 13, 2018)

### Apollo Client (2.3.4)

- Export the `QueryOptions` interface, to make sure it can be used by other
  projects (like `apollo-angular`).
- Fixed an issue caused by typescript changes to the constructor
  `defaultOptions` param, that prevented `query` defaults from passing type
  checks.
  ([@hwillson](https://github.com/hwillson) in [#3585](https://github.com/apollographql/apollo-client/pull/3585))

### Apollo Boost (0.1.9)

- No changes

### Apollo Cache (1.1.11)

- No changes

### Apollo Cache In-Memory (1.2.4)

- No changes

### Apollo Utilities (1.0.15)

- No changes

### Apollo GraphQL Anywhere (4.1.13)

- No changes

## 2.3.3 (June 13, 2018)

### Apollo Client (2.3.3)

- Typescript improvements. Made observable query parameterized on data and
  variables: `ObservableQuery<TData, TVariables>`
  ([@excitement-engineer](https://github.com/excitement-engineer) in [#3140](https://github.com/apollographql/apollo-client/pull/3140))
- Added optional generics to cache manipulation methods (typescript).
  ([@mvestergaard](https://github.com/mvestergaard) in [#3541](https://github.com/apollographql/apollo-client/pull/3541))
- Typescript improvements. Created a new `QueryOptions` interface that
  is now used by `ApolloClient.query` options, instead of the previous
  `WatchQueryOptions` interface. This helps reduce confusion (especially
  in the docs) that made it look like `ApolloClient.query` accepted
  `ApolloClient.watchQuery` only options, like `pollingInterval`.
  ([@hwillson](https://github.com/hwillson) in [#3569](https://github.com/apollographql/apollo-client/pull/3569))

### Apollo Boost (0.1.8)

- Allow `cache` to be given as a configuration option to `ApolloBoost`.
  ([@dandean](https://github.com/dandean) in [#3561](https://github.com/apollographql/apollo-client/pull/3561))
- Allow `headers` and `credentials` to be passed in as configuration
  parameters to the `apollo-boost` `ApolloClient` constructor.
  ([@rzane](https://github.com/rzane) in [#3098](https://github.com/apollographql/apollo-client/pull/3098))

### Apollo Cache (1.1.10)

- Added optional generics to cache manipulation methods (typescript).
  ([@mvestergaard](https://github.com/mvestergaard) in [#3541](https://github.com/apollographql/apollo-client/pull/3541))

### Apollo Cache In-Memory (1.2.3)

- Added optional generics to cache manipulation methods (typescript).
  ([@mvestergaard](https://github.com/mvestergaard) in [#3541](https://github.com/apollographql/apollo-client/pull/3541))
- Restore non-enumerability of `resultFields[ID_KEY]`.
  ([@benjamn](https://github.com/benjamn) in [#3544](https://github.com/apollographql/apollo-client/pull/3544))
- Cache query documents transformed by InMemoryCache.
  ([@benjamn](https://github.com/benjamn) in [#3553](https://github.com/apollographql/apollo-client/pull/3553))

### Apollo Utilities (1.0.14)

- Store key names generated by `getStoreKeyName` now leverage a more
  deterministic approach to handling JSON based strings. This prevents store
  key names from differing when using `args` like
  `{ prop1: 'value1', prop2: 'value2' }` and
  `{ prop2: 'value2', prop1: 'value1' }`.
  ([@gdi2290](https://github.com/gdi2290) in [#2869](https://github.com/apollographql/apollo-client/pull/2869))
- Avoid needless `hasOwnProperty` check in `deepFreeze`.
  ([@benjamn](https://github.com/benjamn) in [#3545](https://github.com/apollographql/apollo-client/pull/3545))

### Apollo GraphQL Anywhere (4.1.12)

- No new changes.

## 2.3.2 (May 29, 2018)

### Apollo Client (2.3.2)

- Fix SSR and `cache-and-network` fetch policy
  ([@dastoori](https://github.com/dastoori) in [#3372](https://github.com/apollographql/apollo-client/pull/3372))
- Fixed an issue where the `updateQuery` method passed to
  `ObservableQuery.fetchMore` was receiving the original query variables,
  instead of the new variables that it used to fetch more data.
  ([@abhiaiyer91](https://github.com/abhiaiyer91) in [#3500](https://github.com/apollographql/apollo-client/pull/3500))
- Fixed an issue involving `Object.setPrototypeOf()` not working on JSC
  (Android), by instead setting the `prototype` of `this` manually.
  ([@seklyza](https://github.com/seklyza) in [#3306](https://github.com/apollographql/apollo-client/pull/3306))
- Added safeguards to make sure `QueryStore.initQuery` and
  `QueryStore.markQueryResult` don't try to set the network status of a
  `fetchMoreForQueryId` query, if it does not exist in the store. This was
  happening when a query component was unmounted while a `fetchMore` was still
  in flight.
  ([@conrad-vanl](https://github.com/conrad-vanl) in [#3367](https://github.com/apollographql/apollo-client/pull/3367), [@doomsower](https://github.com/doomsower) in [#3469](https://github.com/apollographql/apollo-client/pull/3469))

### Apollo Boost (0.1.7)

- Various internal code cleanup, tooling and dependency changes.

### Apollo Cache (1.1.9)

- Various internal code cleanup, tooling and dependency changes.

### Apollo Cache In-Memory (1.2.2)

- Fixed an issue that caused fragment only queries to sometimes fail.
  ([@abhiaiyer91](https://github.com/abhiaiyer91) in [#3507](https://github.com/apollographql/apollo-client/pull/3507))
- Fixed cache invalidation for inlined mixed types in union fields within
  arrays.
  ([@dferber90](https://github.com/dferber90) in [#3422](https://github.com/apollographql/apollo-client/pull/3422))

### Apollo Utilities (1.0.13)

- Make `maybeDeepFreeze` a little more defensive, by always using
  `Object.prototype.hasOwnProperty` (to avoid cases where the object being
  frozen doesn't have its own `hasOwnProperty`).
  ([@jorisroling](https://github.com/jorisroling) in [#3418](https://github.com/apollographql/apollo-client/pull/3418))
- Remove certain small internal caches to prevent memory leaks when using SSR.
  ([@brunorzn](https://github.com/brunorzn) in [#3444](https://github.com/apollographql/apollo-client/pull/3444))

### Apollo GraphQL Anywhere (4.1.11)

- Source files are now excluded when publishing to npm.
  ([@hwillson](https://github.com/hwillson) in [#3454](https://github.com/apollographql/apollo-client/pull/3454))
