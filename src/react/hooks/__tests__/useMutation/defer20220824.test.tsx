import {
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { gql } from "graphql-tag";

import { ApolloClient, CombinedGraphQLErrors } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { Defer20220824Handler } from "@apollo/client/incremental";
import { useMutation } from "@apollo/client/react";
import { MockSubscriptionLink } from "@apollo/client/testing";
import {
  createClientWrapper,
  spyOnConsole,
} from "@apollo/client/testing/internal";

const CREATE_TODO_ERROR = "Failed to create item";

test("resolves a deferred mutation with the full result", async () => {
  using _ = spyOnConsole("error");
  const mutation = gql`
    mutation createTodo($description: String!, $priority: String) {
      createTodo(description: $description, priority: $priority) {
        id
        ... @defer {
          description
          priority
        }
      }
    }
  `;
  const variables = {
    description: "Get milk!",
  };

  const link = new MockSubscriptionLink();

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation),
    { wrapper: createClientWrapper(client) }
  );

  {
    const [, mutation] = await takeSnapshot();

    expect(mutation).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: false,
      called: false,
    });
  }

  const [mutate] = getCurrentSnapshot();

  const promise = mutate({ variables });

  {
    const [, mutation] = await takeSnapshot();

    expect(mutation).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: true,
      called: true,
    });
  }

  setTimeout(() => {
    link.simulateResult({
      result: {
        data: {
          createTodo: {
            id: 1,
            __typename: "Todo",
          },
        },
        hasNext: true,
      },
    });
  });

  await expect(takeSnapshot).not.toRerender();

  setTimeout(() => {
    link.simulateResult(
      {
        result: {
          incremental: [
            {
              data: {
                description: "Get milk!",
                priority: "High",
                __typename: "Todo",
              },
              path: ["createTodo"],
            },
          ],
          hasNext: false,
        },
      },
      true
    );
  });

  {
    const [, mutation] = await takeSnapshot();

    expect(mutation).toStrictEqualTyped({
      data: {
        createTodo: {
          id: 1,
          description: "Get milk!",
          priority: "High",
          __typename: "Todo",
        },
      },
      error: undefined,
      loading: false,
      called: true,
    });
  }

  await expect(promise).resolves.toStrictEqualTyped({
    data: {
      createTodo: {
        id: 1,
        description: "Get milk!",
        priority: "High",
        __typename: "Todo",
      },
    },
  });

  expect(console.error).not.toHaveBeenCalled();
});

test("resolves with resulting errors and calls onError callback", async () => {
  using _ = spyOnConsole("error");
  const mutation = gql`
    mutation createTodo($description: String!, $priority: String) {
      createTodo(description: $description, priority: $priority) {
        id
        ... @defer {
          description
          priority
        }
      }
    }
  `;
  const variables = {
    description: "Get milk!",
  };

  const link = new MockSubscriptionLink();

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  const onError = jest.fn();
  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation(mutation, { onError }),
    {
      wrapper: createClientWrapper(client),
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

  const [createTodo] = getCurrentSnapshot();

  const promise = createTodo({ variables });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: true,
      called: true,
    });
  }

  link.simulateResult({
    result: {
      data: {
        createTodo: {
          id: 1,
          __typename: "Todo",
        },
      },
      hasNext: true,
    },
  });

  await expect(takeSnapshot).not.toRerender();

  link.simulateResult(
    {
      result: {
        incremental: [
          {
            data: null,
            errors: [{ message: CREATE_TODO_ERROR }],
            path: ["createTodo"],
          },
        ],
        hasNext: false,
      },
    },
    true
  );

  await expect(promise).rejects.toThrow(
    new CombinedGraphQLErrors({ errors: [{ message: CREATE_TODO_ERROR }] })
  );

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: new CombinedGraphQLErrors({
        data: { createTodo: { __typename: "Todo", id: 1 } },
        errors: [{ message: CREATE_TODO_ERROR }],
      }),
      loading: false,
      called: true,
    });
  }

  await expect(takeSnapshot).not.toRerender();

  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenLastCalledWith(
    new CombinedGraphQLErrors({
      data: { createTodo: { __typename: "Todo", id: 1 } },
      errors: [{ message: CREATE_TODO_ERROR }],
    }),
    expect.anything()
  );
  expect(console.error).not.toHaveBeenCalled();
});

test("calls the update function with the final merged result data", async () => {
  using _ = spyOnConsole("error");
  const mutation = gql`
    mutation createTodo($description: String!, $priority: String) {
      createTodo(description: $description, priority: $priority) {
        id
        ... @defer {
          description
          priority
        }
      }
    }
  `;
  const variables = {
    description: "Get milk!",
  };

  const link = new MockSubscriptionLink();
  const update = jest.fn();
  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
    incrementalHandler: new Defer20220824Handler(),
  });

  using _disabledAct = disableActEnvironment();
  const { takeSnapshot, getCurrentSnapshot } = await renderHookToSnapshotStream(
    () => useMutation<any>(mutation, { update }),
    {
      wrapper: createClientWrapper(client),
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

  const [createTodo] = getCurrentSnapshot();

  const promiseReturnedByMutate = createTodo({ variables });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: undefined,
      error: undefined,
      loading: true,
      called: true,
    });
  }

  link.simulateResult({
    result: {
      data: {
        createTodo: {
          id: 1,
          __typename: "Todo",
        },
      },
      hasNext: true,
    },
  });

  await expect(takeSnapshot).not.toRerender();

  link.simulateResult(
    {
      result: {
        incremental: [
          {
            data: {
              description: "Get milk!",
              priority: "High",
              __typename: "Todo",
            },
            path: ["createTodo"],
          },
        ],
        hasNext: false,
      },
    },
    true
  );

  await expect(promiseReturnedByMutate).resolves.toStrictEqualTyped({
    data: {
      createTodo: {
        id: 1,
        description: "Get milk!",
        priority: "High",
        __typename: "Todo",
      },
    },
  });

  {
    const [, result] = await takeSnapshot();

    expect(result).toStrictEqualTyped({
      data: {
        createTodo: {
          id: 1,
          description: "Get milk!",
          priority: "High",
          __typename: "Todo",
        },
      },
      error: undefined,
      loading: false,
      called: true,
    });
  }

  await expect(takeSnapshot).not.toRerender();

  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith(
    // the first item is the cache, which we don't need to make any
    // assertions against in this test
    expect.anything(),
    // second argument is the result
    expect.objectContaining({
      data: {
        createTodo: {
          id: 1,
          description: "Get milk!",
          priority: "High",
          __typename: "Todo",
        },
      },
    }),
    // third argument is an object containing context and variables
    // but we only care about variables here
    expect.objectContaining({ variables })
  );

  expect(console.error).not.toHaveBeenCalled();
});

