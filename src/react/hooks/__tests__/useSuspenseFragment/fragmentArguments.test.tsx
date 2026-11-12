import {
  createRenderStream,
  disableActEnvironment,
  renderHookToSnapshotStream,
  useTrackRenders,
} from "@testing-library/react-render-stream";
import React, { Suspense } from "react";

import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { useSuspenseFragment } from "@apollo/client/react";
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
      useSuspenseFragment({
        fragment,
        from: { __typename: "User", id: "1" },
        variables: { size: 96 },
      }),
    { wrapper: createClientWrapper(client) }
  );

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "large.png" },
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
  });

  await expect(takeSnapshot).not.toRerender();
});

test("suspends until data for the root fragment arguments is written", async () => {
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

  const { render, takeRender, replaceSnapshot } = createRenderStream({
    initialSnapshot: {
      result: null as useSuspenseFragment.Result<unknown> | null,
    },
  });

  function SuspenseFallback() {
    useTrackRenders();
    return <div>Loading</div>;
  }

  function App() {
    useTrackRenders();

    const result = useSuspenseFragment({
      fragment,
      from: { __typename: "User", id: "1" },
      variables: { size: 32 },
    });

    replaceSnapshot({ result });

    return null;
  }

  using _disabledAct = disableActEnvironment();
  await render(
    <Suspense fallback={<SuspenseFallback />}>
      <App />
    </Suspense>,
    { wrapper: createClientWrapper(client) }
  );

  {
    const { renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([SuspenseFallback]);
  }

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  {
    const { snapshot, renderedComponents } = await takeRender();

    expect(renderedComponents).toStrictEqual([App]);
    expect(snapshot.result).toStrictEqualTyped({
      data: { __typename: "User", id: "1", avatar: "small.png" },
    });
  }

  await expect(takeRender).not.toRerender();
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
      useSuspenseFragment({
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
  });

  await rerender({ size: 32 });

  await expect(takeSnapshot()).resolves.toStrictEqualTyped({
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
  });

  await expect(takeSnapshot).not.toRerender();
});
