import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import React from "react";
import { delay, of } from "rxjs";

import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";
import { ApolloProvider, useMutation } from "@apollo/client/react";

const echoContextLink = new ApolloLink((operation) => {
  // filter out internal client set context values
  const { queryDeduplication, optimisticResponse, ...context } =
    operation.getContext();
  return of({
    data: { echo: { context } },
  }).pipe(delay(20));
});

test("context is provided from hook", async () => {
  const mutation = gql`
    mutation {
      echo {
        context
      }
    }
  `;

  const client = new ApolloClient({
    link: echoContextLink,
    cache: new InMemoryCache(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation, { context: { foo: true } }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: false,
      called: false,
    });
  }

  const [execute] = getCurrentSnapshot();

  await execute();

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: true,
      called: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: { echo: { context: { foo: true } } },
      error: undefined,
      loading: false,
      called: true,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("context provided to execute function overrides hook context", async () => {
  const mutation = gql`
    mutation {
      echo {
        context
      }
    }
  `;

  const client = new ApolloClient({
    link: echoContextLink,
    cache: new InMemoryCache(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation, { context: { foo: true } }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: false,
      called: false,
    });
  }

  const [execute] = getCurrentSnapshot();

  await execute({ context: { bar: true } });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: true,
      called: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: { echo: { context: { bar: true } } },
      error: undefined,
      loading: false,
      called: true,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("allows context as callback called with context from hook", async () => {
  const mutation = gql`
    mutation {
      echo {
        context
      }
    }
  `;

  const client = new ApolloClient({
    link: echoContextLink,
    cache: new InMemoryCache(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation, { context: { foo: true } }),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: false,
      called: false,
    });
  }

  const [execute] = getCurrentSnapshot();

  const contextFn = jest.fn((ctx) => ({ ...ctx, bar: true }));
  await execute({ context: contextFn });

  expect(contextFn).toHaveBeenCalledTimes(1);
  expect(contextFn).toHaveBeenCalledWith({ foo: true });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: true,
      called: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        echo: { context: { foo: true, bar: true } },
      },
      error: undefined,
      loading: false,
      called: true,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});

test("provides undefined to context callback if context is not provided to hook", async () => {
  const mutation = gql`
    mutation {
      echo {
        context
      }
    }
  `;

  const client = new ApolloClient({
    link: echoContextLink,
    cache: new InMemoryCache(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    }
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: false,
      called: false,
    });
  }

  const [execute] = getCurrentSnapshot();

  const contextFn = jest.fn((ctx) => ({ ...ctx, bar: true }));
  await execute({ context: contextFn });

  expect(contextFn).toHaveBeenCalledTimes(1);
  expect(contextFn).toHaveBeenCalledWith(undefined);

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: true,
      called: true,
    });
  }

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        echo: { context: { bar: true } },
      },
      error: undefined,
      loading: false,
      called: true,
    });
  }

  await expect(takeSnapshot).not.toRerender();
});
