import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import React from "react";

import { gql, NetworkStatus } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { MockedProvider } from "@apollo/client/testing/react";

test("updates poll interval when rerendering with different pollInterval", async () => {
  const query = gql`
    query {
      hello
    }
  `;

  let count = 0;

  const wrapper = ({ children }: any) => (
    <MockedProvider
      mocks={[
        {
          request: { query },
          result: () => ({ data: { hello: `world ${++count}` } }),
          delay: 10,
          maxUsageCount: Number.POSITIVE_INFINITY,
        },
      ]}
    >
      {children}
    </MockedProvider>
  );

  using _disabledAct = disableActEnvironment();
  const renderStream = await renderHookToSnapshotStream(
    ({ pollInterval }) => useLazyQuery(query, { pollInterval }),
    { initialProps: { pollInterval: 50 }, wrapper }
  );

  const { takeSnapshot, getCurrentSnapshot, rerender } = renderStream;

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: false,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  const [execute] = getCurrentSnapshot();

  await expect(execute()).resolves.toStrictEqualTyped({
    data: { hello: "world 1" },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      dataState: "empty",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.loading,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: { hello: "world 1" },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot({ timeout: 60 });

    expect(result).toStrictEqualTyped({
      data: { hello: "world 1" },
      dataState: "complete",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.poll,
      previousData: undefined,
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: { hello: "world 2" },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { hello: "world 1" },
      variables: {},
    });
  }

  await rerender({ pollInterval: 100 });

  await expect(renderStream).toRerenderWithSimilarSnapshot();
  await expect(renderStream).not.toRerender({ timeout: 60 });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: { hello: "world 2" },
      dataState: "complete",
      called: true,
      loading: true,
      networkStatus: NetworkStatus.poll,
      previousData: { hello: "world 1" },
      variables: {},
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: { hello: "world 3" },
      dataState: "complete",
      called: true,
      loading: false,
      networkStatus: NetworkStatus.ready,
      previousData: { hello: "world 2" },
      variables: {},
    });
  }

  await rerender({ pollInterval: 0 });
  await expect(renderStream).toRerenderWithSimilarSnapshot();

  await expect(renderStream).not.toRerender({ timeout: 150 });
});
