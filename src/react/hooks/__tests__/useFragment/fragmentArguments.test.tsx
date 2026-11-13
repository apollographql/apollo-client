import assert from "node:assert";

import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";

import type { TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useFragment } from "@apollo/client/react";
import { MockLink } from "@apollo/client/testing";
import type { WithFragmentInfo } from "@apollo/client/testing/internal";
import { createClientWrapper } from "@apollo/client/testing/internal";
import { fragmentInfoSymbol } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

type MaskedUser = {
  __typename: "User";
  id: string;
};

test("binds variables to the fragment arguments of the root fragment", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () =>
      useFragment({
        fragment,
        from: { __typename: "User", id: "1" },
        variables: { size: 96 },
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small-updated.png" },
  });

  await expect(takeSnapshot).not.toRerender();

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(takeSnapshot).not.toRerender();
});

test("reads data for the new root fragment arguments when variables change", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
    ({ size }) =>
      useFragment({
        fragment,
        from: { __typename: "User", id: "1" },
        variables: { size },
      }),
    {
      initialProps: { size: 96 },
      wrapper: createClientWrapper(client),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await rerender({ size: 32 });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "small.png" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
  });

  await expect(takeSnapshot).not.toRerender();
});

test("binds fragment arguments from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    WithFragmentInfo<{ lead: MaskedUser; member: MaskedUser }>,
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserCard(size: 96)
      }
      member {
        id
        ...UserCard(size: 32)
      }
    }

    ${fragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
            member: { __typename: "User", id: "1", avatar: "small.png" },
          },
        },
      },
    ]),
  });

  const { data } = await client.query({ query });

  expect(data).toStrictEqualTyped({
    lead: {
      __typename: "User",
      id: "1",
      [fragmentInfoSymbol]: {
        operationVariables: {},
        fragments: { UserCard: { variables: { size: 96 } } },
      },
    },
    member: {
      __typename: "User",
      id: "1",
      [fragmentInfoSymbol]: {
        operationVariables: {},
        fragments: { UserCard: { variables: { size: 32 } } },
      },
    },
  });
  assert(data);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot } = await renderHookToSnapshotStream(
    () => useFragment({ fragment, from: data.lead }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small-updated.png" },
  });

  await expect(takeSnapshot).not.toRerender();

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
  });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(takeSnapshot).not.toRerender();
});

test("reads data for new fragment arguments when from changes to a query result with the same identity", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    WithFragmentInfo<{ lead: MaskedUser; member: MaskedUser }>,
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserCard(size: 96)
      }
      member {
        id
        ...UserCard(size: 32)
      }
    }

    ${fragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
            member: { __typename: "User", id: "1", avatar: "small.png" },
          },
        },
      },
    ]),
  });

  const { data } = await client.query({ query });

  expect(data).toStrictEqualTyped({
    lead: {
      __typename: "User",
      id: "1",
      [fragmentInfoSymbol]: {
        operationVariables: {},
        fragments: { UserCard: { variables: { size: 96 } } },
      },
    },
    member: {
      __typename: "User",
      id: "1",
      [fragmentInfoSymbol]: {
        operationVariables: {},
        fragments: { UserCard: { variables: { size: 32 } } },
      },
    },
  });
  assert(data);

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, rerender } = await renderHookToSnapshotStream(
    ({ from }) => useFragment({ fragment, from }),
    {
      initialProps: { from: data.lead },
      wrapper: createClientWrapper(client),
    }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await rerender({ from: data.member });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "small.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(takeSnapshot).not.toRerender();
});
