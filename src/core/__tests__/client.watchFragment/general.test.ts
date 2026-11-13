import assert from "node:assert";

import type { TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  gql,
  InMemoryCache,
  NetworkStatus,
} from "@apollo/client";
import { MockLink } from "@apollo/client/testing";
import type { WithFragmentInfo } from "@apollo/client/testing/internal";
import {
  ObservableStream,
  wait,
  withProdMode,
} from "@apollo/client/testing/internal";
import { fragmentInfoSymbol } from "@apollo/client/utilities/internal";

test("can subscribe multiple times to watchFragment", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ItemFragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment: ItemFragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment: ItemFragment,
    from: { __typename: "Item", id: 1 },
  });

  using stream1 = new ObservableStream(observable);
  using stream2 = new ObservableStream(observable);

  await expect(stream1).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream2).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment: ItemFragment,
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
  });

  await expect(stream1).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream2).toEmitTypedValue({
    data: { __typename: "Item", id: 1, text: "Item #1 updated" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream1).not.toEmitAnything();
  await expect(stream2).not.toEmitAnything();
});

test("dedupes watches when subscribing multiple times", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ItemFragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const cache = new InMemoryCache();
  const client = new ApolloClient({
    cache,
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment: ItemFragment,
    data: { __typename: "Item", id: 1, text: "Item #1" },
  });

  const observable = client.watchFragment({
    fragment: ItemFragment,
    from: { __typename: "Item", id: 1 },
  });

  expect(cache).toHaveNumWatches(0);

  const sub1 = observable.subscribe(() => {});
  const sub2 = observable.subscribe(() => {});
  expect(cache).toHaveNumWatches(1);

  const sub3 = observable.subscribe(() => {});
  expect(cache).toHaveNumWatches(1);

  [sub1, sub2, sub3].forEach((sub) => sub.unsubscribe());
  await wait(0);
  expect(cache).toHaveNumWatches(0);

  const sub4 = observable.subscribe(() => {});
  expect(cache).toHaveNumWatches(1);

  sub4.unsubscribe();
  await wait(0);
  expect(cache).toHaveNumWatches(0);
});

test("emits null with from: null", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ItemFragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment: ItemFragment,
    from: null,
  });

  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: null,
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("emits empty object when data is not in the cache", async () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ItemFragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      id
      text
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment: ItemFragment,
    from: { __typename: "Item", id: 1 },
  });

  using stream = new ObservableStream(observable);

  await expect(stream).toEmitTypedValue({
    data: {},
    dataState: "partial",
    complete: false,
    missing: "Dangling reference to missing Item:1 object",
  });

  await expect(stream).not.toEmitAnything();
});

test("binds operation variables used by a masked fragment from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    WithFragmentInfo<{ user: { __typename: "User"; id: string } }>,
    { size: number }
  > = gql`
    query Example($size: Int) {
      user {
        id
        ...UserCard
      }
    }

    ${fragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { size: 96 } },
        result: {
          data: {
            user: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { size: 96 } })
  );

  await expect(queryStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  const result = await queryStream.takeNext();

  expect(result).toStrictEqualTyped({
    data: {
      user: {
        __typename: "User",
        id: "1",
        [fragmentInfoSymbol]: {
          operationVariables: { size: 96 },
          fragments: {},
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  assert(result.dataState === "complete");

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: result.data.user })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds operation variables used by a nested masked fragment from a fragment result passed to from", async () => {
  const avatarFragment = gql`
    fragment UserAvatar on User {
      avatar(size: $size)
    }
  `;

  const cardFragment: TypedDocumentNode<
    WithFragmentInfo<{ __typename: "User"; id: string; name: string }>
  > = gql`
    fragment UserCard on User {
      id
      name
      ...UserAvatar
    }

    ${avatarFragment}
  `;

  const query: TypedDocumentNode<
    WithFragmentInfo<{ user: { __typename: "User"; id: string } }>,
    { size: number }
  > = gql`
    query Example($size: Int) {
      user {
        id
        ...UserCard
      }
    }

    ${cardFragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { size: 96 } },
        result: {
          data: {
            user: {
              __typename: "User",
              id: "1",
              name: "Alice",
              avatar: "large.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { size: 96 } })
  );

  await expect(queryStream).toEmitTypedValue({
    data: undefined,
    dataState: "empty",
    loading: true,
    networkStatus: NetworkStatus.loading,
    partial: true,
  });

  const queryResult = await queryStream.takeNext();

  expect(queryResult).toStrictEqualTyped({
    data: {
      user: {
        __typename: "User",
        id: "1",
        [fragmentInfoSymbol]: {
          operationVariables: { size: 96 },
          fragments: {},
        },
      },
    },
    dataState: "complete",
    loading: false,
    networkStatus: NetworkStatus.ready,
    partial: false,
  });
  assert(queryResult.dataState === "complete");

  using cardStream = new ObservableStream(
    client.watchFragment({
      fragment: cardFragment,
      fragmentName: "UserCard",
      from: queryResult.data.user,
    })
  );

  const cardResult = await cardStream.takeNext();

  expect(cardResult).toStrictEqualTyped({
    data: {
      __typename: "User",
      id: "1",
      name: "Alice",
      [fragmentInfoSymbol]: {
        operationVariables: { size: 96 },
        fragments: {},
      },
    },
    dataState: "complete",
    complete: true,
  });
  assert(cardResult.dataState === "complete");

  using stream = new ObservableStream(
    client.watchFragment({ fragment: avatarFragment, from: cardResult.data })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("returns the same observable for new from objects that identify the same entity", () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "1" },
  });

  expect(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
    })
  ).toBe(observable);
});

test("returns the same observable in production for new from objects that identify the same entity", () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  using _ = withProdMode();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "1" },
  });

  expect(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
    })
  ).toBe(observable);
});

test("returns the same observable when fields other than key fields of from change", () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "1", name: "Alice" },
  });

  expect(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1", name: "Alice (updated)" },
    })
  ).toBe(observable);
});

test("returns the same observable for each entity when calls for different entities are interleaved", () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const first = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "1" },
  });
  const second = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "2" },
  });

  expect(second).not.toBe(first);
  expect(
    client.watchFragment({ fragment, from: { __typename: "User", id: "1" } })
  ).toBe(first);
  expect(
    client.watchFragment({ fragment, from: { __typename: "User", id: "2" } })
  ).toBe(second);
});

test("returns the same observable for each entity when calls for different entities are interleaved across ticks", async () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const first = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "1" },
  });
  const second = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "2" },
  });

  // Memoization caches clean up 100ms after they grow over their limit.
  await wait(150);

  expect(
    client.watchFragment({ fragment, from: { __typename: "User", id: "1" } })
  ).toBe(first);
  expect(
    client.watchFragment({ fragment, from: { __typename: "User", id: "2" } })
  ).toBe(second);
});

test("returns the same observable in production for each entity when calls for different entities are interleaved across ticks", async () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  using _ = withProdMode();

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const first = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "1" },
  });
  const second = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "2" },
  });

  // Memoization caches clean up 100ms after they grow over their limit.
  await wait(150);

  expect(
    client.watchFragment({ fragment, from: { __typename: "User", id: "1" } })
  ).toBe(first);
  expect(
    client.watchFragment({ fragment, from: { __typename: "User", id: "2" } })
  ).toBe(second);
});

test("returns a different observable for a different entity", () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "1" },
  });

  expect(
    client.watchFragment({ fragment, from: { __typename: "User", id: "2" } })
  ).not.toBe(observable);
});

test("returns a different observable for different variables", () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment,
    from: { __typename: "User", id: "1" },
    variables: { size: 96 },
  });

  expect(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
      variables: { size: 96 },
    })
  ).toBe(observable);
  expect(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
      variables: { size: 32 },
    })
  ).not.toBe(observable);
});

test("returns the same observable for new from arrays that identify the same entities", () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "User", id: "1" },
      { __typename: "User", id: "2" },
    ],
  });

  expect(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "User", id: "1", name: "Alice" },
        { __typename: "User", id: "2", name: "Bob" },
      ],
    })
  ).toBe(observable);
});

test("returns a different observable for from arrays with entities in a different order", () => {
  const fragment = gql`
    fragment UserFields on User {
      id
      name
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  const observable = client.watchFragment({
    fragment,
    from: [
      { __typename: "User", id: "1" },
      { __typename: "User", id: "2" },
    ],
  });

  expect(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "User", id: "2" },
        { __typename: "User", id: "1" },
      ],
    })
  ).not.toBe(observable);
});
