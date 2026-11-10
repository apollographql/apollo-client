import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";

import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useFragment } from "@apollo/client/react";
import { createClientWrapper } from "@apollo/client/testing/internal";

enableExperimentalFragmentVariables();

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
