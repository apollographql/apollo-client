import { act } from "@testing-library/react";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import {
  createRenderStream,
  disableActEnvironment,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { userEvent } from "@testing-library/user-event";
import { expectTypeOf } from "expect-type";
import fetchMock from "fetch-mock";
import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import React, { useEffect } from "react";
import { Observable } from "rxjs";

import { InMemoryCache } from "@apollo/client/cache";
import {
  ApolloClient,
  ApolloLink,
  ApolloQueryResult,
  Cache,
  CombinedGraphQLErrors,
  NetworkStatus,
  ObservableQuery,
  TypedDocumentNode,
} from "@apollo/client/core";
import { BatchHttpLink } from "@apollo/client/link/batch-http";
import { FetchResult } from "@apollo/client/link/core";
import { Masked } from "@apollo/client/masking";
import { ApolloProvider } from "@apollo/client/react/context";
import {
  MockedResponse,
  MockLink,
  mockSingleLink,
  MockSubscriptionLink,
} from "@apollo/client/testing";
import { MockedProvider } from "@apollo/client/testing/react";
import { invariant } from "@apollo/client/utilities/invariant";

import { spyOnConsole } from "../../../testing/internal/index.js";
import { useMutation } from "../useMutation.js";
import { useQuery } from "../useQuery.js";

const IS_REACT_17 = React.version.startsWith("17");
const IS_REACT_18 = React.version.startsWith("18");
const IS_REACT_19 = React.version.startsWith("19");

describe("useMutation Hook", () => {
  interface Todo {
    id: number;
    description: string;
    priority: string;
  }

  const CREATE_TODO_MUTATION = gql`
    mutation createTodo($description: String!, $priority: String) {
      createTodo(description: $description, priority: $priority) {
        id
        description
        priority
      }
    }
  `;

  const CREATE_TODO_RESULT = {
    createTodo: {
      id: 1,
      description: "Get milk!",
      priority: "High",
      __typename: "Todo",
    },
  };

  const CREATE_TODO_ERROR = "Failed to create item";

  it("should handle a simple mutation properly", async () => {
    const variables = {
      description: "Get milk!",
    };

    const mocks = [
      {
        request: {
          query: CREATE_TODO_MUTATION,
          variables,
        },
        result: { data: CREATE_TODO_RESULT },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () => useMutation(CREATE_TODO_MUTATION),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        // TODO: Include data and make it a required property
        loading: false,
        called: false,
      });
    }

    const [createTodo] = getCurrentSnapshot();

    await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
      data: CREATE_TODO_RESULT,
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: undefined,
        // TODO: Remove error field when there is no error
        error: undefined,
        loading: true,
        called: true,
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: CREATE_TODO_RESULT,
        error: undefined,
        loading: false,
        called: true,
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("should be able to call mutations as an effect", async () => {
    const variables = {
      description: "Get milk!",
    };

    const mocks = [
      {
        request: {
          query: CREATE_TODO_MUTATION,
          variables,
        },
        result: { data: CREATE_TODO_RESULT },
        delay: 20,
      },
    ];

    const useCreateTodo = () => {
      const [createTodo, { loading, data }] = useMutation(CREATE_TODO_MUTATION);
      useEffect(() => {
        void createTodo({ variables });
      }, [variables]);

      return { loading, data };
    };

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useCreateTodo(),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      }
    );

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      loading: false,
    });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: undefined,
      loading: true,
    });

    await expect(takeSnapshot()).resolves.toEqualStrictTyped({
      data: CREATE_TODO_RESULT,
      loading: false,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("should ensure the mutation callback function has a stable identity no matter what", async () => {
    const variables1 = {
      description: "Get milk",
    };

    const data1 = {
      createTodo: {
        id: 1,
        description: "Get milk!",
        priority: "High",
        __typename: "Todo",
      },
    };

    const variables2 = {
      description: "Write blog post",
    };

    const data2 = {
      createTodo: {
        id: 1,
        description: "Write blog post",
        priority: "High",
        __typename: "Todo",
      },
    };

    const mocks = [
      {
        request: {
          query: CREATE_TODO_MUTATION,
          variables: variables1,
        },
        result: { data: data1 },
        delay: 20,
      },
      {
        request: {
          query: CREATE_TODO_MUTATION,
          variables: variables2,
        },
        result: { data: data2 },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, rerender, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        ({ variables }) => useMutation(CREATE_TODO_MUTATION, { variables }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
          initialProps: {
            variables: variables1,
          },
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        loading: false,
        called: false,
      });
    }

    const [createTodo] = getCurrentSnapshot();

    await expect(createTodo()).resolves.toEqualStrictTyped({
      data: data1,
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
        called: true,
      });
    }

    expect(getCurrentSnapshot()[0]).toBe(createTodo);

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: data1,
        error: undefined,
        loading: false,
        called: true,
      });
    }

    expect(getCurrentSnapshot()[0]).toBe(createTodo);

    await rerender({ variables: variables2 });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: data1,
        error: undefined,
        loading: false,
        called: true,
      });
    }

    expect(getCurrentSnapshot()[0]).toBe(createTodo);

    await expect(createTodo()).resolves.toEqualStrictTyped({
      data: data2,
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
        called: true,
      });
    }

    expect(getCurrentSnapshot()[0]).toBe(createTodo);

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: data2,
        error: undefined,
        loading: false,
        called: true,
      });
    }

    expect(getCurrentSnapshot()[0]).toBe(createTodo);

    await expect(takeSnapshot).not.toRerender();
  });

  it("should not call setResult on an unmounted component", async () => {
    using consoleSpies = spyOnConsole("error");
    const variables = {
      description: "Get milk!",
    };

    const mocks = [
      {
        request: {
          query: CREATE_TODO_MUTATION,
          variables,
        },
        result: { data: CREATE_TODO_RESULT },
      },
    ];

    const useCreateTodo = () => {
      const [createTodo, { reset }] = useMutation(CREATE_TODO_MUTATION);
      return { reset, createTodo };
    };

    const { result, unmount } = renderHook(() => useCreateTodo(), {
      wrapper: ({ children }) => (
        <MockedProvider mocks={mocks}>{children}</MockedProvider>
      ),
    });

    unmount();

    await act(async () => {
      await result.current.createTodo({ variables });
      result.current.reset();
    });

    expect(consoleSpies.error).not.toHaveBeenCalled();
  });

  describe("mutate function upon error", () => {
    it("resolves with the resulting data and errors", async () => {
      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
            errors: [{ message: CREATE_TODO_ERROR }],
          },
          delay: 20,
        },
      ];

      const onError = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useMutation(CREATE_TODO_MUTATION, { onError }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      // TODO: This should either be an `error` property or it should be the
      // raw error array. This value is a lie against the TypeScript type.
      // This will be fixed by https://github.com/apollographql/apollo-client/issues/7167
      // when we address the issue with onError.
      await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
        data: undefined,
        // @ts-expect-error
        errors: new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenLastCalledWith(
        new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
        expect.anything()
      );
    });

    it("should reject when there’s an error and no error policy is set", async () => {
      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            errors: [{ message: CREATE_TODO_ERROR }],
          },
          delay: 20,
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useMutation(CREATE_TODO_MUTATION),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      await expect(createTodo({ variables })).rejects.toThrow(
        new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }])
      );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it(`should reject when errorPolicy is 'none'`, async () => {
      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
            errors: [{ message: CREATE_TODO_ERROR }],
          },
          delay: 20,
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: "none" }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      await expect(createTodo({ variables })).rejects.toThrow(
        new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }])
      );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it(`should resolve with 'data' and 'error' properties when errorPolicy is 'all'`, async () => {
      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
            errors: [{ message: CREATE_TODO_ERROR }],
          },
          delay: 20,
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: "all" }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
        data: CREATE_TODO_RESULT,
        errors: [{ message: CREATE_TODO_ERROR }],
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: CREATE_TODO_RESULT,
          error: new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it(`should call onError when errorPolicy is 'all'`, async () => {
      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
            errors: [{ message: CREATE_TODO_ERROR }],
          },
          delay: 20,
        },
      ];

      const onError = jest.fn();
      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useMutation(CREATE_TODO_MUTATION, {
              errorPolicy: "all",
              onError,
              onCompleted,
            }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
        data: CREATE_TODO_RESULT,
        errors: [{ message: CREATE_TODO_ERROR }],
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: CREATE_TODO_RESULT,
          error: new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
          loading: false,
          called: true,
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenLastCalledWith(
        new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
        expect.anything()
      );
      expect(onCompleted).not.toHaveBeenCalled();
    });

    it(`should ignore errors when errorPolicy is 'ignore'`, async () => {
      using consoleSpy = spyOnConsole("error");
      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            errors: [{ message: CREATE_TODO_ERROR }],
          },
          delay: 20,
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: "ignore" }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
        data: undefined,
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error.mock.calls[0][0]).toMatch("Missing field");
    });

    it(`should not call onError when errorPolicy is 'ignore'`, async () => {
      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            errors: [{ message: CREATE_TODO_ERROR }],
          },
          delay: 20,
        },
      ];

      const onError = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useMutation(CREATE_TODO_MUTATION, {
              errorPolicy: "ignore",
              onError,
            }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
        data: undefined,
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: false,
          called: true,
        });
      }

      expect(onError).not.toHaveBeenCalled();
    });
  });

  it("should return the current client instance in the result object", async () => {
    const client = new ApolloClient({ cache: new InMemoryCache() });

    const { result } = renderHook(() => useMutation(CREATE_TODO_MUTATION), {
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });
    expect(result.current[1].client).toBe(client);
  });

  it("should call client passed to execute function", async () => {
    using _disabledAct = disableActEnvironment();

    const defaultClient = new ApolloClient({
      cache: new InMemoryCache(),
      link: new MockLink([
        {
          request: { query: CREATE_TODO_MUTATION },
          result: { errors: [{ message: "Oops wrong client" }] },
          delay: 20,
        },
      ]),
    });

    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () => useMutation(CREATE_TODO_MUTATION),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={defaultClient}>{children}</ApolloProvider>
          ),
        }
      );

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: new MockLink([
        {
          request: { query: CREATE_TODO_MUTATION },
          result: { data: CREATE_TODO_RESULT },
          delay: 20,
        },
      ]),
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        loading: false,
        called: false,
      });
    }

    const [createTodo] = getCurrentSnapshot();

    await expect(createTodo({ client })).resolves.toEqualStrictTyped({
      data: CREATE_TODO_RESULT,
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
        called: true,
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: CREATE_TODO_RESULT,
        error: undefined,
        loading: false,
        called: true,
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  // TODO: Do we want to keep this variable merge behavior?
  it("should merge provided variables", async () => {
    const CREATE_TODO_DATA = {
      createTodo: {
        id: 1,
        description: "Get milk!",
        priority: "Low",
        __typename: "Todo",
      },
    };
    const mocks = [
      {
        request: {
          query: CREATE_TODO_MUTATION,
          variables: {
            priority: "Low",
            description: "Get milk.",
          },
        },
        result: {
          data: CREATE_TODO_DATA,
        },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () =>
          useMutation<
            { createTodo: Todo },
            { priority?: string; description?: string }
          >(CREATE_TODO_MUTATION, {
            variables: { priority: "Low" },
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        loading: false,
        called: false,
      });
    }

    const [createTodo] = getCurrentSnapshot();

    await expect(
      createTodo({ variables: { description: "Get milk." } })
    ).resolves.toEqualStrictTyped({
      data: CREATE_TODO_DATA,
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
        called: true,
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: CREATE_TODO_DATA,
        error: undefined,
        loading: false,
        called: true,
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("should be possible to reset the mutation", async () => {
    const CREATE_TODO_DATA = {
      createTodo: {
        id: 1,
        priority: "Low",
        description: "Get milk!",
        __typename: "Todo",
      },
    };

    const mocks = [
      {
        request: {
          query: CREATE_TODO_MUTATION,
          variables: {
            priority: "Low",
            description: "Get milk.",
          },
        },
        result: {
          data: CREATE_TODO_DATA,
        },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot, getCurrentSnapshot } =
      await renderHookToSnapshotStream(
        () =>
          useMutation<
            { createTodo: Todo },
            { priority: string; description: string }
          >(CREATE_TODO_MUTATION),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        loading: false,
        called: false,
      });
    }

    const [createTodo] = getCurrentSnapshot();

    await expect(
      createTodo({ variables: { priority: "Low", description: "Get milk." } })
    ).resolves.toEqualStrictTyped({
      data: CREATE_TODO_DATA,
    });

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
        called: true,
      });
    }

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        data: CREATE_TODO_DATA,
        error: undefined,
        loading: false,
        called: true,
      });
    }

    getCurrentSnapshot()[1].reset();

    {
      const [, result] = await takeSnapshot();

      expect(result).toEqualStrictTyped({
        loading: false,
        called: false,
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("resetting while a mutation is running: ensure that the result doesn't end up in the hook", async () => {
    const CREATE_TODO_DATA = {
      createTodo: {
        id: 1,
        priority: "Low",
        description: "Get milk!",
        __typename: "Todo",
      },
    };

    const mocks: MockedResponse[] = [
      {
        request: {
          query: CREATE_TODO_MUTATION,
          variables: {
            priority: "Low",
            description: "Get milk.",
          },
        },
        result: {
          data: CREATE_TODO_DATA,
        },
        delay: 20,
      },
    ];

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () =>
        useMutation<
          { createTodo: Todo },
          { priority: string; description: string }
        >(CREATE_TODO_MUTATION),
      {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      }
    );

    let createTodo: Awaited<ReturnType<typeof takeSnapshot>>[0];
    let reset: Awaited<ReturnType<typeof takeSnapshot>>[1]["reset"];

    {
      const [mutate, result] = await takeSnapshot();
      createTodo = mutate;
      reset = result.reset;
      //initial value
      expect(result).toEqualStrictTyped({
        loading: false,
        called: false,
      });
    }

    const fetchResult = createTodo({
      variables: { priority: "Low", description: "Get milk." },
    });

    {
      const [, result] = await takeSnapshot();

      // started loading
      expect(result).toEqualStrictTyped({
        data: undefined,
        error: undefined,
        loading: true,
        called: true,
      });
    }

    reset();

    {
      const [, result] = await takeSnapshot();

      // reset to initial value
      expect(result).toEqualStrictTyped({
        loading: false,
        called: false,
      });
    }

    await expect(fetchResult).resolves.toEqualStrictTyped({
      data: CREATE_TODO_DATA,
    });

    await expect(takeSnapshot).not.toRerender();
  });

  describe("Callbacks", () => {
    it("should allow passing an onCompleted handler to the execution function", async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: "Low",
          description: "Get milk!",
          __typename: "Todo",
        },
      };

      const variables = {
        priority: "Low",
        description: "Get milk.",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_DATA,
          },
          delay: 20,
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useMutation<
              { createTodo: Todo },
              { priority: string; description: string }
            >(CREATE_TODO_MUTATION),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      const onCompleted = jest.fn();
      const onError = jest.fn();
      await expect(
        createTodo({ variables, onCompleted, onError })
      ).resolves.toEqualStrictTyped({
        data: CREATE_TODO_DATA,
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: CREATE_TODO_DATA,
          error: undefined,
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();

      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(onCompleted).toHaveBeenCalledWith(
        CREATE_TODO_DATA,
        expect.objectContaining({ variables })
      );
      expect(onError).toHaveBeenCalledTimes(0);
    });

    it("prefers the onCompleted handler passed to the execution function rather than the hook", async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: "Low",
          description: "Get milk!",
          __typename: "Todo",
        },
      };
      const variables = {
        priority: "Low",
        description: "Get milk.",
      };
      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_DATA,
          },
          delay: 20,
        },
      ];

      const hookOnCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useMutation(CREATE_TODO_MUTATION, { onCompleted: hookOnCompleted }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();
      const onCompleted = jest.fn();

      await expect(
        createTodo({ variables, onCompleted })
      ).resolves.toEqualStrictTyped({ data: CREATE_TODO_DATA });

      expect(onCompleted).toHaveBeenCalledTimes(1);
      expect(hookOnCompleted).not.toHaveBeenCalled();
    });

    it("should allow passing an onError handler to the execution function", async () => {
      const errors = [new GraphQLError(CREATE_TODO_ERROR)];
      const variables = {
        priority: "Low",
        description: "Get milk.",
      };
      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            errors,
          },
          delay: 20,
        },
      ];

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useMutation<
              { createTodo: Todo },
              { priority: string; description: string }
            >(CREATE_TODO_MUTATION),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      const onCompleted = jest.fn();
      const onError = jest.fn();

      // TODO: Ensure this rejects when fixing issue with onError
      await expect(
        createTodo({ variables, onCompleted, onError })
      ).resolves.toEqualStrictTyped({
        data: undefined,
        // @ts-expect-error needs to be fixed
        errors: new CombinedGraphQLErrors(errors),
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: new CombinedGraphQLErrors(errors),
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();

      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        new CombinedGraphQLErrors(errors),
        expect.objectContaining({ variables })
      );
    });

    it("prefers the onError handler passed to the execution function instead of the hook", async () => {
      const variables = {
        priority: "Low",
        description: "Get milk.",
      };
      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            errors: [{ message: CREATE_TODO_ERROR }],
          },
          delay: 20,
        },
      ];

      const hookOnError = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useMutation(CREATE_TODO_MUTATION, { onError: hookOnError }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();
      const onError = jest.fn();
      // TODO: Fix this when fixing issue with onError
      await expect(
        createTodo({ variables, onError })
      ).resolves.toEqualStrictTyped({
        data: undefined,
        // @ts-expect-error
        errors: new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
          loading: false,
          called: true,
        });
      }

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
        expect.objectContaining({ variables })
      );
      expect(hookOnError).not.toHaveBeenCalled();
    });

    it("should allow updating onError while mutation is executing", async () => {
      const errors = [{ message: CREATE_TODO_ERROR }];
      const variables = {
        priority: "Low",
        description: "Get milk.",
      };
      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            errors,
          },
          delay: 20,
        },
      ];

      const onCompleted = jest.fn();
      const onError = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot, rerender } =
        await renderHookToSnapshotStream(
          ({ onCompleted, onError }) => {
            return useMutation<
              { createTodo: Todo },
              { priority: string; description: string }
            >(CREATE_TODO_MUTATION, { onCompleted, onError });
          },
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
            initialProps: { onCompleted, onError },
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      const onError1 = jest.fn();
      await rerender({ onCompleted, onError: onError1 });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
        data: undefined,
        // @ts-expect-error
        errors: new CombinedGraphQLErrors(errors),
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: new CombinedGraphQLErrors(errors),
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();

      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onError1).toHaveBeenCalledTimes(1);
      expect(onError1).toHaveBeenCalledWith(
        new CombinedGraphQLErrors(errors),
        expect.objectContaining({ variables })
      );
    });

    it("should never allow onCompleted handler to be stale", async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: "Low",
          description: "Get milk!",
          __typename: "Todo",
        },
      };

      const variables = {
        priority: "Low",
        description: "Get milk2.",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_DATA,
          },
          delay: 20,
        },
      ];

      const onCompleted = jest.fn();
      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot, rerender } =
        await renderHookToSnapshotStream(
          ({ onCompleted }) => {
            return useMutation<
              { createTodo: Todo },
              { priority: string; description: string }
            >(CREATE_TODO_MUTATION, { onCompleted });
          },
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
            initialProps: { onCompleted },
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const onCompleted1 = jest.fn();
      await rerender({ onCompleted: onCompleted1 });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();
      await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
        data: CREATE_TODO_DATA,
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: CREATE_TODO_DATA,
          error: undefined,
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();

      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted1).toHaveBeenCalledWith(
        CREATE_TODO_DATA,
        expect.objectContaining({ variables })
      );
    });

    it("should allow updating onCompleted while mutation is executing", async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: "Low",
          description: "Get milk!",
          __typename: "Todo",
        },
      };

      const variables = {
        priority: "Low",
        description: "Get milk2.",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_DATA,
          },
          delay: 20,
        },
      ];

      const onCompleted = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot, rerender } =
        await renderHookToSnapshotStream(
          ({ onCompleted }) => {
            return useMutation<
              { createTodo: Todo },
              { priority: string; description: string }
            >(CREATE_TODO_MUTATION, { onCompleted });
          },
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
            initialProps: { onCompleted },
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      const onCompleted1 = jest.fn();
      await rerender({ onCompleted: onCompleted1 });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      await expect(createTodo({ variables })).resolves.toEqualStrictTyped({
        data: CREATE_TODO_DATA,
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: CREATE_TODO_DATA,
          error: undefined,
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();

      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onCompleted1).toHaveBeenCalledTimes(1);
      expect(onCompleted1).toHaveBeenCalledWith(
        CREATE_TODO_DATA,
        expect.objectContaining({ variables })
      );
    });

    // https://github.com/apollographql/apollo-client/issues/12008
    it("does not call onError if errors are thrown in the onCompleted callback", async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          priority: "Low",
          description: "Get milk!",
          __typename: "Todo",
        },
      };

      const variables = {
        priority: "Low",
        description: "Get milk2.",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_DATA,
          },
        },
      ];

      const onError = jest.fn();

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot } = await renderHookToSnapshotStream(
        () =>
          useMutation(CREATE_TODO_MUTATION, {
            onCompleted: () => {
              throw new Error("Oops");
            },
            onError,
          }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

      const [createTodo] = await takeSnapshot();

      await expect(createTodo({ variables })).rejects.toEqual(
        new Error("Oops")
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("ROOT_MUTATION cache data", () => {
    const startTime = Date.now();
    const link = new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          setTimeout(() => {
            observer.next({
              data: {
                __typename: "Mutation",
                doSomething: {
                  __typename: "MutationPayload",
                  time: startTime,
                },
              },
            });
            observer.complete();
          }, 20);
        })
    );

    const mutation: TypedDocumentNode<any> = gql`
      mutation DoSomething {
        doSomething {
          time
        }
      }
    `;

    it("should be removed by default after the mutation", async () => {
      let timeReadCount = 0;
      let timeMergeCount = 0;
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            MutationPayload: {
              fields: {
                time: {
                  read(ms: number = Date.now()) {
                    ++timeReadCount;
                    return new Date(ms);
                  },
                  merge(existing, incoming: number) {
                    ++timeMergeCount;
                    expect(existing).toBeUndefined();
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(() => useMutation(mutation), {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [mutate] = getCurrentSnapshot();

      await expect(
        mutate({
          update(cache, { data }) {
            expect(data).toEqualStrictTyped({
              doSomething: {
                __typename: "MutationPayload",
                time: new Date(startTime),
              },
            });

            expect(timeReadCount).toBe(1);
            expect(timeMergeCount).toBe(1);
            // The contents of the ROOT_MUTATION object exist only briefly,
            // for the duration of the mutation update, and are removed
            // after the mutation write is finished.
            expect(cache.extract()).toEqual({
              ROOT_MUTATION: {
                __typename: "Mutation",
                doSomething: {
                  __typename: "MutationPayload",
                  time: startTime,
                },
              },
            });
          },
        })
      ).resolves.toEqualStrictTyped({
        data: {
          doSomething: {
            __typename: "MutationPayload",
            time: new Date(startTime),
          },
        },
      });

      expect(timeReadCount).toBe(1);
      expect(timeMergeCount).toBe(1);
      // The contents of the ROOT_MUTATION object exist only briefly,
      // for the duration of the mutation update, and are removed after
      // the mutation write is finished.
      expect(client.cache.extract()).toEqual({
        ROOT_MUTATION: {
          __typename: "Mutation",
        },
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: {
            doSomething: {
              __typename: "MutationPayload",
              time: new Date(startTime),
            },
          },
          error: undefined,
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("can be preserved by passing keepRootFields: true", async () => {
      let timeReadCount = 0;
      let timeMergeCount = 0;

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            MutationPayload: {
              fields: {
                time: {
                  read(ms: number = Date.now()) {
                    ++timeReadCount;
                    return new Date(ms);
                  },
                  merge(existing, incoming: number) {
                    ++timeMergeCount;
                    expect(existing).toBeUndefined();
                    return incoming;
                  },
                },
              },
            },
          },
        }),
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () =>
            useMutation(mutation, {
              keepRootFields: true,
            }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [mutate] = getCurrentSnapshot();

      await expect(
        mutate({
          update(cache, { data }) {
            expect(data).toEqualStrictTyped({
              doSomething: {
                __typename: "MutationPayload",
                time: new Date(startTime),
              },
            });
            expect(timeReadCount).toBe(1);
            expect(timeMergeCount).toBe(1);
            expect(cache.extract()).toEqual({
              ROOT_MUTATION: {
                __typename: "Mutation",
                doSomething: {
                  __typename: "MutationPayload",
                  time: startTime,
                },
              },
            });
          },
        })
      ).resolves.toEqualStrictTyped({
        data: {
          doSomething: {
            __typename: "MutationPayload",
            time: new Date(startTime),
          },
        },
      });

      expect(timeReadCount).toBe(1);
      expect(timeMergeCount).toBe(1);
      expect(client.cache.extract()).toEqual({
        ROOT_MUTATION: {
          __typename: "Mutation",
          doSomething: {
            __typename: "MutationPayload",
            time: startTime,
          },
        },
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: {
            doSomething: {
              __typename: "MutationPayload",
              time: new Date(startTime),
            },
          },
          error: undefined,
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });
  });

  describe("Update function", () => {
    it("should be called with the provided variables", async () => {
      const variables = { description: "Get milk!" };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: { data: CREATE_TODO_RESULT },
        },
      ];

      let variablesMatched = false;
      const Component = () => {
        const [createTodo] = useMutation(CREATE_TODO_MUTATION, {
          update(_, __, options) {
            expect(options.variables).toEqual(variables);
            variablesMatched = true;
          },
        });

        useEffect(() => {
          void createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      await waitFor(() => expect(variablesMatched).toBe(true));
    });

    it("should be called with the provided context", async () => {
      const context = { id: 3 };

      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: { data: CREATE_TODO_RESULT },
        },
      ];

      let foundContext = false;
      const Component = () => {
        const [createTodo] = useMutation<
          Todo,
          { description: string },
          { id: number }
        >(CREATE_TODO_MUTATION, {
          context,
          update(_, __, options) {
            expect(options.context).toEqual(context);
            foundContext = true;
          },
        });

        useEffect(() => {
          void createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(foundContext).toBe(true);
      });
    });

    describe("If context is not provided", () => {
      it("should be undefined", async () => {
        const variables = {
          description: "Get milk!",
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables,
            },
            result: { data: CREATE_TODO_RESULT },
          },
        ];

        let checkedContext = false;
        const Component = () => {
          const [createTodo] = useMutation(CREATE_TODO_MUTATION, {
            update(_, __, options) {
              expect(options.context).toBeUndefined();
              checkedContext = true;
            },
          });

          useEffect(() => {
            void createTodo({ variables });
          }, []);

          return null;
        };

        render(
          <MockedProvider mocks={mocks}>
            <Component />
          </MockedProvider>
        );

        await waitFor(() => {
          expect(checkedContext).toBe(true);
        });
      });
    });
  });

  describe("Optimistic response", () => {
    it("should support optimistic response handling", async () => {
      const optimisticResponse = {
        __typename: "Mutation",
        createTodo: {
          id: 1,
          description: "TEMPORARY",
          priority: "High",
          __typename: "Todo",
        },
      };

      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: { data: CREATE_TODO_RESULT },
          delay: 20,
        },
      ];

      const cache = new InMemoryCache();
      const client = new ApolloClient({ cache, link: new MockLink(mocks) });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => useMutation(CREATE_TODO_MUTATION, { optimisticResponse }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const [createTodo] = getCurrentSnapshot();

      const promise = createTodo({ variables });

      expect(cache.extract(true)["Todo:1"]).toEqual(
        optimisticResponse.createTodo
      );

      await expect(promise).resolves.toEqualStrictTyped({
        data: CREATE_TODO_RESULT,
      });

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: undefined,
          error: undefined,
          loading: true,
          called: true,
        });
      }

      {
        const [, result] = await takeSnapshot();

        expect(result).toEqualStrictTyped({
          data: CREATE_TODO_RESULT,
          error: undefined,
          loading: false,
          called: true,
        });
      }

      await expect(takeSnapshot).not.toRerender();
    });

    it("should be called with the provided context", async () => {
      const optimisticResponse = {
        __typename: "Mutation",
        createTodo: {
          id: 1,
          description: "TEMPORARY",
          priority: "High",
          __typename: "Todo",
        },
      };

      const context = { id: 3 };

      const variables = {
        description: "Get milk!",
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: { data: CREATE_TODO_RESULT },
        },
      ];

      const contextFn = jest.fn();

      const Component = () => {
        const [createTodo] = useMutation(CREATE_TODO_MUTATION, {
          optimisticResponse,
          context,
          update(_, __, options) {
            contextFn(options.context);
          },
        });

        useEffect(() => {
          void createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      await waitFor(() => {
        expect(contextFn).toHaveBeenCalledTimes(2);
      });
      expect(contextFn).toHaveBeenCalledWith(context);
    });
  });

  describe("refetching queries", () => {
    const GET_TODOS_QUERY = gql`
      query getTodos {
        todos {
          id
          description
          priority
        }
      }
    `;

    const GET_TODOS_RESULT_1 = {
      todos: [
        {
          id: 2,
          description: "Walk the dog",
          priority: "Medium",
          __typename: "Todo",
        },
        {
          id: 3,
          description: "Call mom",
          priority: "Low",
          __typename: "Todo",
        },
      ],
    };

    const GET_TODOS_RESULT_2 = {
      todos: [
        {
          id: 1,
          description: "Get milk!",
          priority: "High",
          __typename: "Todo",
        },
        {
          id: 2,
          description: "Walk the dog",
          priority: "Medium",
          __typename: "Todo",
        },
        {
          id: 3,
          description: "Call mom",
          priority: "Low",
          __typename: "Todo",
        },
      ],
    };

    it("can pass onQueryUpdated to useMutation", async () => {
      interface TData {
        todoCount: number;
      }
      const countQuery: TypedDocumentNode<TData> = gql`
        query Count {
          todoCount @client
        }
      `;

      const optimisticResponse = {
        __typename: "Mutation",
        createTodo: {
          id: 1,
          description: "TEMPORARY",
          priority: "High",
          __typename: "Todo",
        },
      };

      const variables = {
        description: "Get milk!",
      };

      const client = new ApolloClient({
        cache: new InMemoryCache({
          typePolicies: {
            Query: {
              fields: {
                todoCount(count = 0) {
                  return count;
                },
              },
            },
          },
        }),

        link: mockSingleLink({
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: { data: CREATE_TODO_RESULT },
          delay: 20,
        }),
      });

      // The goal of this test is to make sure onQueryUpdated gets called as
      // part of the createTodo mutation, so we use this reobservePromise to
      // await the calling of onQueryUpdated.
      interface OnQueryUpdatedResults {
        obsQuery: ObservableQuery;
        diff: Cache.DiffResult<TData>;
        result: ApolloQueryResult<TData>;
      }
      let resolveOnUpdate: (results: OnQueryUpdatedResults) => any;
      const onUpdatePromise = new Promise<OnQueryUpdatedResults>((resolve) => {
        resolveOnUpdate = resolve;
      }).then((onUpdateResult) => {
        expect(onUpdateResult.diff).toEqual({
          complete: true,
          result: {
            todoCount: 1,
          },
        });
        expect(onUpdateResult.result).toEqualStrictTyped({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            todoCount: 1,
          },
          partial: false,
        });
      });

      using _disabledAct = disableActEnvironment();
      const { takeSnapshot, getCurrentSnapshot } =
        await renderHookToSnapshotStream(
          () => ({
            query: useQuery(countQuery),
            mutation: useMutation(CREATE_TODO_MUTATION, {
              optimisticResponse,
              update(cache) {
                const result = cache.readQuery({ query: countQuery });

                cache.writeQuery({
                  query: countQuery,
                  data: {
                    todoCount: (result ? result.todoCount : 0) + 1,
                  },
                });
              },
            }),
          }),
          {
            wrapper: ({ children }) => (
              <ApolloProvider client={client}>{children}</ApolloProvider>
            ),
          }
        );

      {
        const {
          query,
          mutation: [, mutation],
        } = await takeSnapshot();

        expect(query).toEqualStrictTyped({
          data: { todoCount: 0 },
          networkStatus: NetworkStatus.ready,
          loading: false,
          previousData: undefined,
          variables: {},
        });
        expect(mutation).toEqualStrictTyped({
          loading: false,
          called: false,
        });
      }

      const {
        mutation: [createTodo],
      } = getCurrentSnapshot();

      await expect(
        createTodo({
          variables,
          async onQueryUpdated(obsQuery, diff) {
            const result = await obsQuery.reobserve();
            resolveOnUpdate({ obsQuery, diff, result });
            return result;
          },
        })
      ).resolves.toEqualStrictTyped({ data: CREATE_TODO_RESULT });

      {
        const {
          query,
          mutation: [, mutation],
        } = await takeSnapshot();

        if (IS_REACT_17) {
          expect(query).toEqualStrictTyped({
            data: { todoCount: 0 },
            networkStatus: NetworkStatus.ready,
            loading: false,
            previousData: undefined,
            variables: {},
          });

          expect(mutation).toEqualStrictTyped({
            data: undefined,
            error: undefined,
            loading: true,
            called: true,
          });
        } else {
          expect(query).toEqualStrictTyped({
            data: { todoCount: 1 },
            networkStatus: NetworkStatus.ready,
            loading: false,
            previousData: { todoCount: 0 },
            variables: {},
          });
        }

        if (IS_REACT_18) {
          expect(mutation).toEqualStrictTyped({
            loading: false,
            called: false,
          });
        } else {
          expect(mutation).toEqualStrictTyped({
            data: undefined,
            error: undefined,
            loading: true,
            called: true,
          });
        }
      }

      if (IS_REACT_19) {
        const {
          query,
          mutation: [, mutation],
        } = await takeSnapshot();

        expect(query).toEqualStrictTyped({
          data: { todoCount: 1 },
          networkStatus: NetworkStatus.ready,
          loading: false,
          previousData: { todoCount: 0 },
          variables: {},
        });

        expect(mutation).toEqualStrictTyped({
          data: CREATE_TODO_RESULT,
          error: undefined,
          loading: false,
          called: true,
        });
      } else {
        {
          const {
            query,
            mutation: [, mutation],
          } = await takeSnapshot();

          expect(query).toEqualStrictTyped({
            data: { todoCount: 1 },
            networkStatus: NetworkStatus.ready,
            loading: false,
            previousData: { todoCount: 0 },
            variables: {},
          });

          expect(mutation).toEqualStrictTyped({
            data: undefined,
            error: undefined,
            loading: true,
            called: true,
          });
        }

        {
          const {
            query,
            mutation: [, mutation],
          } = await takeSnapshot();

          expect(query).toEqualStrictTyped({
            data: { todoCount: 1 },
            networkStatus: NetworkStatus.ready,
            loading: false,
            previousData: { todoCount: 0 },
            variables: {},
          });

          expect(mutation).toEqualStrictTyped({
            data: CREATE_TODO_RESULT,
            error: undefined,
            loading: false,
            called: true,
          });
        }
      }

      await expect(takeSnapshot).not.toRerender();
      await expect(onUpdatePromise).resolves.toBe(undefined);
    });

    it("refetchQueries with operation names should update cache", async () => {
      const variables = { description: "Get milk!" };
      const mocks = [
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_1 },
        },
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
          },
        },
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_2 },
        },
      ];

      const link = mockSingleLink(...mocks);
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitFor(
        () => {
          expect(result.current.query.loading).toBe(false);
        },
        { interval: 1 }
      );

      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      await act(async () => {
        await mutate({
          variables,
          refetchQueries: ["getTodos"],
        });
      });

      await waitFor(
        () => {
          expect(result.current.query.data).toEqual(mocks[2].result.data);
        },
        { interval: 1 }
      );
      expect(result.current.query.loading).toBe(false);

      expect(client.readQuery({ query: GET_TODOS_QUERY })).toEqual(
        mocks[2].result.data
      );
    });

    it("refetchQueries with document nodes should update cache", async () => {
      const variables = { description: "Get milk!" };
      const mocks = [
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_1 },
        },
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
          },
          delay: 10,
        },
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_2 },
          delay: 10,
        },
      ];

      const link = mockSingleLink(...mocks);
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitFor(
        () => {
          expect(result.current.query.loading).toBe(false);
        },
        { interval: 1 }
      );

      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      let mutation: Promise<unknown>;
      act(() => {
        mutation = mutate({
          variables,
          refetchQueries: [GET_TODOS_QUERY],
        });
      });
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await act(async () => {
        await mutation;
      });
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await waitFor(
        () => {
          expect(result.current.query.data).toEqual(mocks[2].result.data);
        },
        { interval: 1 }
      );
      expect(result.current.query.loading).toBe(false);
      expect(client.readQuery({ query: GET_TODOS_QUERY })).toEqual(
        mocks[2].result.data
      );
    });

    it("refetchQueries should update cache after unmount", async () => {
      const variables = { description: "Get milk!" };
      const mocks = [
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_1 },
        },
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables,
          },
          result: {
            data: CREATE_TODO_RESULT,
          },
        },
        {
          request: {
            query: GET_TODOS_QUERY,
          },
          result: { data: GET_TODOS_RESULT_2 },
        },
      ];

      const link = mockSingleLink(...mocks);
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result, unmount } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitFor(
        () => {
          expect(result.current.query.loading).toBe(false);
        },
        { interval: 1 }
      );

      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      let onMutationDone: Function;
      const mutatePromise = new Promise(
        (resolve) => (onMutationDone = resolve)
      );

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await act(async () => {
        await mutate({
          variables,
          refetchQueries: ["getTodos"],
          update() {
            unmount();
          },
        }).then((result) => {
          expect(result.data).toEqual(CREATE_TODO_RESULT);
          onMutationDone();
        });
      });
      await mutatePromise;

      await waitFor(() => {
        expect(client.readQuery({ query: GET_TODOS_QUERY })).toEqual(
          mocks[2].result.data
        );
      });
    });

    it("using onQueryUpdated callback should not prevent cache broadcast", async () => {
      // Mutating this array makes the tests below much more difficult to reason
      // about, so instead we reassign the numbersArray variable to remove
      // elements, without mutating the previous array object.
      let numbersArray: ReadonlyArray<{ id: string; value: number }> = [
        { id: "1", value: 324 },
        { id: "2", value: 729 },
        { id: "3", value: 987 },
        { id: "4", value: 344 },
        { id: "5", value: 72 },
        { id: "6", value: 899 },
        { id: "7", value: 222 },
      ];

      // Modifying this value means we can return a subset of our numbers array
      // without needing to mutate or reassignn the original numbersArray.
      let totalNumbers: number = numbersArray.length;

      type TNumbersQuery = {
        numbers: {
          __typename: "NumbersResult";
          id: string;
          sum: number;
          numbersArray: ReadonlyArray<{
            id: string;
            value: number;
          }>;
        };
      };

      function getNumbersData(length: number = totalNumbers): TNumbersQuery {
        const numbers = numbersArray.slice(0, length);

        return {
          numbers: {
            __typename: "NumbersResult",
            id: "numbersId",
            numbersArray: numbers,
            sum: numbers.reduce((sum, b) => sum + b.value, 0),
          },
        };
      }

      const link = new ApolloLink((operation) => {
        return new Observable((observer) => {
          setTimeout(() => {
            const { operationName } = operation;
            if (operationName === "NumbersQuery") {
              observer.next({
                data: getNumbersData(),
              });
            } else if (operationName === "RemoveNumberMutation") {
              observer.next({
                data: {
                  removeLastNumber: getLastNumber(),
                },
              });

              totalNumbers--;
            }
            observer.complete();
          }, 50);
        });
      });

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          typePolicies: {
            NumbersResult: {
              fields: {
                numbersArray: { merge: false },
                sum(_, { readField }) {
                  const numbersArray =
                    readField<TNumbersQuery["numbers"]["numbersArray"]>(
                      "numbersArray"
                    );
                  return (numbersArray || []).reduce(
                    (sum, item) => sum + item.value,
                    0
                  );
                },
              },
            },
          },
        }),
      });

      const NumbersQuery: TypedDocumentNode<TNumbersQuery> = gql`
        query NumbersQuery {
          numbers {
            id
            sum
            numbersArray {
              id
              value
            }
          }
        }
      `;

      const RemoveNumberMutation = gql`
        mutation RemoveNumberMutation {
          removeLastNumber {
            id
          }
        }
      `;

      const renderStream = createRenderStream({
        initialSnapshot: {
          useQueryResult: null as useQuery.Result<TNumbersQuery> | null,
          useMutationResult: null as useMutation.ResultTuple<any, any> | null,
        },
      });

      function App() {
        renderStream.mergeSnapshot({
          useQueryResult: useQuery(NumbersQuery, {
            notifyOnNetworkStatusChange: true,
          }),
          useMutationResult: useMutation(RemoveNumberMutation, {
            update(cache) {
              const oldData = cache.readQuery({ query: NumbersQuery });
              cache.writeQuery({
                query: NumbersQuery,
                data:
                  oldData ?
                    {
                      ...oldData,
                      numbers: {
                        ...oldData.numbers,
                        numbersArray: oldData.numbers.numbersArray.slice(0, -1),
                      },
                    }
                  : {
                      numbers: {
                        __typename: "NumbersResult",
                        id: "numbersId",
                        sum: 0,
                        numbersArray: [],
                      },
                    },
              });
            },
          }),
        });

        return null;
      }

      using _disabledAct = disableActEnvironment();
      await renderStream.render(<App />, {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      async function getNextSnapshot() {
        const { snapshot } = await renderStream.takeRender();

        invariant(snapshot.useQueryResult);
        invariant(snapshot.useMutationResult);

        return {
          useQueryResult: snapshot.useQueryResult,
          useMutationResult: snapshot.useMutationResult,
        };
      }

      function getLastNumber() {
        const numbers = numbersArray.slice(0, totalNumbers);

        return numbers[numbers.length - 1];
      }

      expect(getLastNumber()).toEqual({ id: "7", value: 222 });

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;

        expect(useQueryResult.loading).toBe(true);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.loading);
        expect(useQueryResult.data).toBeUndefined();

        expect(mutationResult.loading).toBe(false);
        expect(mutationResult.called).toBe(false);
        expect(mutationResult.data).toBeUndefined();
      }

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(7);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        expect(useQueryResult.data).toEqual(data);

        expect(mutationResult.loading).toBe(false);
        expect(mutationResult.called).toBe(false);
        expect(mutationResult.data).toBeUndefined();
      }

      const [mutate] =
        renderStream.getCurrentRender().snapshot.useMutationResult!;

      let promise = mutate();

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(7);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        expect(useQueryResult.data).toEqual(data);

        expect(mutationResult.loading).toBe(true);
        expect(mutationResult.called).toBe(true);
        expect(mutationResult.data).toBeUndefined();
      }

      // Not passing an onQueryUpdated callback should allow cache
      // broadcasts to propagate as normal. The point of this test is to
      // demonstrate that *adding* onQueryUpdated should not prevent cache
      // broadcasts (see below for where we test that).
      await expect(promise).resolves.toEqual({
        data: {
          removeLastNumber: {
            id: "7",
          },
        },
      });

      expect(getLastNumber()).toEqual({ id: "6", value: 899 });

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(6);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        expect(useQueryResult.data).toEqual(data);

        expect(mutationResult.loading).toBe(true);
        expect(mutationResult.called).toBe(true);
        expect(mutationResult.data).toBeUndefined();
      }

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(6);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        expect(useQueryResult.data).toEqual(data);

        expect(mutationResult.loading).toBe(false);
        expect(mutationResult.called).toBe(true);
        expect(mutationResult.data).toEqual({ removeLastNumber: { id: "7" } });
      }

      promise = mutate({
        // Adding this onQueryUpdated callback, which merely examines the
        // updated query and its DiffResult, should not change the broadcast
        // behavior of the ObservableQuery.
        onQueryUpdated(oq, diff) {
          expect(oq.queryName).toBe("NumbersQuery");
          expect(diff.result.numbers.numbersArray.length).toBe(5);
          expect(diff.result.numbers.sum).toBe(2456);
        },
      });

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(6);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        expect(useQueryResult.data).toEqual(data);

        expect(mutationResult.loading).toBe(true);
        expect(mutationResult.called).toBe(true);
        expect(mutationResult.data).toBeUndefined();
      }

      await expect(promise).resolves.toEqual({
        data: {
          removeLastNumber: {
            id: "6",
          },
        },
      });

      expect(getLastNumber()).toEqual({ id: "5", value: 72 });

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(5);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        expect(useQueryResult.data).toEqual(data);

        expect(mutationResult.loading).toBe(true);
        expect(mutationResult.called).toBe(true);
        expect(mutationResult.data).toBeUndefined();
      }

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(5);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        expect(useQueryResult.data).toEqual(data);

        expect(mutationResult.loading).toBe(false);
        expect(mutationResult.called).toBe(true);
        expect(mutationResult.data).toEqual({ removeLastNumber: { id: "6" } });
      }

      promise = mutate({
        onQueryUpdated(oq, diff) {
          expect(oq.queryName).toBe("NumbersQuery");
          expect(diff.result.numbers.numbersArray.length).toBe(4);
          expect(diff.result.numbers.sum).toBe(2384);
          // Returning false from onQueryUpdated prevents the cache broadcast.
          return false;
        },
      });

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(5);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        expect(useQueryResult.data).toEqual(data);

        expect(mutationResult.loading).toBe(true);
        expect(mutationResult.called).toBe(true);
        expect(mutationResult.data).toBeUndefined();
      }

      await expect(promise).resolves.toEqual({
        data: {
          removeLastNumber: {
            id: "5",
          },
        },
      });

      expect(getLastNumber()).toEqual({ id: "4", value: 344 });

      {
        const { useQueryResult, useMutationResult } = await getNextSnapshot();
        const [, mutationResult] = useMutationResult;
        const data = getNumbersData();

        expect(data.numbers.numbersArray).toHaveLength(4);

        expect(useQueryResult.loading).toBe(false);
        expect(useQueryResult.networkStatus).toBe(NetworkStatus.ready);
        // This mutation did not braodcast results, so we expect our numbers to
        // equal the previous set.
        expect(useQueryResult.data).toEqual(getNumbersData(5));

        expect(mutationResult.loading).toBe(false);
        expect(mutationResult.called).toBe(true);
        expect(mutationResult.data).toEqual({ removeLastNumber: { id: "5" } });
      }

      await expect(renderStream).not.toRerender();
    });

    it("refetchQueries should work with BatchHttpLink", async () => {
      const MUTATION_1 = gql`
        mutation DoSomething {
          doSomething {
            message
          }
        }
      `;

      const QUERY_1 = gql`
        query Items {
          items {
            id
          }
        }
      `;

      fetchMock.restore();

      const responseBodies = [
        { data: { items: [{ id: 1 }, { id: 2 }] } },
        { data: { doSomething: { message: "success" } } },
        { data: { items: [{ id: 1 }, { id: 2 }, { id: 3 }] } },
      ];

      fetchMock.post(
        "/graphql",
        (url, opts) =>
          new Promise((resolve) => {
            resolve({
              body: responseBodies.shift(),
            });
          })
      );

      const Test = () => {
        const { data } = useQuery<any>(QUERY_1);
        const [mutate] = useMutation<any>(MUTATION_1, {
          awaitRefetchQueries: true,
          refetchQueries: [QUERY_1],
        });

        const { items = [] } = data || {};

        return (
          <>
            <button
              onClick={() => {
                return mutate();
              }}
              type="button"
            >
              mutate
            </button>
            {items.map((c: any) => (
              <div key={c.id}>item {c.id}</div>
            ))}
          </>
        );
      };

      const client = new ApolloClient({
        link: new BatchHttpLink({
          uri: "/graphql",
          batchMax: 10,
        }),
        cache: new InMemoryCache(),
      });

      render(
        <ApolloProvider client={client}>
          <Test />
        </ApolloProvider>
      );

      await waitFor(() => screen.findByText("item 1"));
      await userEvent.click(screen.getByRole("button", { name: /mutate/i }));
      await waitFor(() => screen.findByText("item 3"));
    });
  });
  describe("defer", () => {
    const CREATE_TODO_MUTATION_DEFER = gql`
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
    it("resolves a deferred mutation with the full result", async () => {
      using consoleSpies = spyOnConsole("error");
      const link = new MockSubscriptionLink();

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const useCreateTodo = () => {
        const [createTodo, { loading, data }] = useMutation(
          CREATE_TODO_MUTATION_DEFER
        );

        useEffect(() => {
          void createTodo({ variables });
        }, [variables]);

        return { loading, data };
      };

      const { result } = renderHook(() => useCreateTodo(), {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

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

      // When defer is used in a mutation, the final value resolves
      // in a single result
      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { interval: 1 }
      );

      expect(result.current.data).toEqual({
        createTodo: {
          id: 1,
          description: "Get milk!",
          priority: "High",
          __typename: "Todo",
        },
      });
      expect(consoleSpies.error).not.toHaveBeenCalled();
    });
    it("resolves with resulting errors and calls onError callback", async () => {
      using consoleSpies = spyOnConsole("error");
      const link = new MockSubscriptionLink();

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const onError = jest.fn();
      const { result } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION_DEFER, { onError }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );

      const createTodo = result.current[0];

      let fetchResult: any;

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

      setTimeout(() => {
        link.simulateResult(
          {
            result: {
              incremental: [
                {
                  data: null,
                  errors: [new GraphQLError(CREATE_TODO_ERROR)],
                  path: ["createTodo"],
                },
              ],
              hasNext: false,
            },
          },
          true
        );
      });
      await act(async () => {
        fetchResult = await createTodo({ variables });
      });

      await waitFor(() => {
        expect(fetchResult.errors).toEqual(
          new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }])
        );
      });
      await waitFor(() => {
        expect(fetchResult.data).toBe(undefined);
      });
      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onError).toHaveBeenLastCalledWith(
          new CombinedGraphQLErrors([{ message: CREATE_TODO_ERROR }]),
          expect.anything()
        );
      });
      await waitFor(() => {
        expect(consoleSpies.error).not.toHaveBeenCalled();
      });
    });
    it("calls the update function with the final merged result data", async () => {
      using consoleSpies = spyOnConsole("error");
      const link = new MockSubscriptionLink();
      const update = jest.fn();
      const client = new ApolloClient({
        link,
        cache: new InMemoryCache(),
      });

      const { result } = renderHook(
        () => useMutation<any>(CREATE_TODO_MUTATION_DEFER, { update }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>{children}</ApolloProvider>
          ),
        }
      );
      const [createTodo] = result.current;

      let promiseReturnedByMutate: Promise<FetchResult>;

      await act(async () => {
        promiseReturnedByMutate = createTodo({ variables });
      });

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

      await act(async () => {
        await promiseReturnedByMutate;
      });

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
      await waitFor(() => {
        expect(consoleSpies.error).not.toHaveBeenCalled();
      });
    });
  });
});

describe("data masking", () => {
  test("masks data returned from useMutation when dataMasking is `true`", async () => {
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      };
    }

    const mutation: TypedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
        delay: 10,
      },
    ];

    const client = new ApolloClient({
      dataMasking: true,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useMutation(mutation),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [mutate, result] = await takeSnapshot();

    expect(result.loading).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeUndefined();

    {
      const { data, errors } = await mutate();

      expect(data).toEqual({
        updateUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      });
      expect(errors).toBeUndefined();
    }

    {
      const [, result] = await takeSnapshot();

      expect(result.loading).toBe(true);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeUndefined();
    }

    {
      const [, result] = await takeSnapshot();

      expect(result.loading).toBe(false);
      expect(result.data).toEqual({
        updateUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      });
      expect(result.error).toBeUndefined();
    }

    await expect(takeSnapshot).not.toRerender();
  });

  test("does not mask data returned from useMutation when dataMasking is `false`", async () => {
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      };
    }

    const mutation: TypedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
        delay: 10,
      },
    ];

    const client = new ApolloClient({
      dataMasking: false,
      cache: new InMemoryCache(),
      link: new MockLink(mocks),
    });

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useMutation(mutation),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [mutate, result] = await takeSnapshot();

    expect(result.loading).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBeUndefined();

    {
      const { data, errors } = await mutate();

      expect(data).toEqual({
        updateUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      });
      expect(errors).toBeUndefined();
    }

    {
      const [, result] = await takeSnapshot();

      expect(result.loading).toBe(true);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeUndefined();
    }

    {
      const [, result] = await takeSnapshot();

      expect(result.loading).toBe(false);
      expect(result.data).toEqual({
        updateUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
          age: 30,
        },
      });
      expect(result.error).toBeUndefined();
    }

    await expect(takeSnapshot).not.toRerender();
  });

  test("passes masked data to onCompleted, does not pass masked data to update", async () => {
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: number;
        name: string;
      };
    }

    const mutation: TypedDocumentNode<Mutation, never> = gql`
      mutation MaskedMutation {
        updateUser {
          id
          name
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const mocks = [
      {
        request: { query: mutation },
        result: {
          data: {
            updateUser: {
              __typename: "User",
              id: 1,
              name: "Test User",
              age: 30,
            },
          },
        },
        delay: 10,
      },
    ];

    const cache = new InMemoryCache();
    const client = new ApolloClient({
      dataMasking: true,
      cache,
      link: new MockLink(mocks),
    });

    const update = jest.fn();
    const onCompleted = jest.fn();

    using _disabledAct = disableActEnvironment();
    const { takeSnapshot } = await renderHookToSnapshotStream(
      () => useMutation(mutation, { onCompleted, update }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    const [mutate] = await takeSnapshot();

    await mutate();

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith(
      {
        updateUser: {
          __typename: "User",
          id: 1,
          name: "Test User",
        },
      },
      expect.anything()
    );

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      cache,
      {
        data: {
          updateUser: {
            __typename: "User",
            id: 1,
            name: "Test User",
            age: 30,
          },
        },
      },
      { context: undefined, variables: {} }
    );
  });
});

describe.skip("Type Tests", () => {
  test("NoInfer prevents adding arbitrary additional variables", () => {
    const typedNode = {} as TypedDocumentNode<{ foo: string }, { bar: number }>;
    useMutation(typedNode, {
      variables: {
        bar: 4,
        // @ts-expect-error
        nonExistingVariable: "string",
      },
    });
  });

  test("uses any as masked and unmasked type when using plain DocumentNode", () => {
    const mutation = gql`
      mutation ($id: ID!) {
        updateUser(id: $id) {
          id
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const [mutate, { data }] = useMutation(mutation, {
      optimisticResponse: { foo: "foo" },
      updateQueries: {
        TestQuery: (_, { mutationResult }) => {
          expectTypeOf(mutationResult.data).toMatchTypeOf<any>();

          return {};
        },
      },
      refetchQueries(result) {
        expectTypeOf(result.data).toMatchTypeOf<any>();

        return "active";
      },
      onCompleted(data) {
        expectTypeOf(data).toMatchTypeOf<any>();
      },
      update(_, result) {
        expectTypeOf(result.data).toMatchTypeOf<any>();
      },
    });

    expectTypeOf(data).toMatchTypeOf<any>();
    expectTypeOf(mutate()).toMatchTypeOf<Promise<FetchResult<any>>>();
  });

  test("uses TData type when using plain TypedDocumentNode", () => {
    interface Mutation {
      updateUser: {
        __typename: "User";
        id: string;
        age: number;
      };
    }

    interface Variables {
      id: string;
    }

    const mutation: TypedDocumentNode<Mutation, Variables> = gql`
      mutation ($id: ID!) {
        updateUser(id: $id) {
          id
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const [mutate, { data }] = useMutation(mutation, {
      variables: { id: "1" },
      optimisticResponse: {
        updateUser: { __typename: "User", id: "1", age: 30 },
      },
      updateQueries: {
        TestQuery: (_, { mutationResult }) => {
          expectTypeOf(mutationResult.data).toMatchTypeOf<
            Mutation | null | undefined
          >();

          return {};
        },
      },
      refetchQueries(result) {
        expectTypeOf(result.data).toMatchTypeOf<Mutation | null | undefined>();

        return "active";
      },
      onCompleted(data) {
        expectTypeOf(data).toMatchTypeOf<Mutation>();
      },
      update(_, result) {
        expectTypeOf(result.data).toMatchTypeOf<Mutation | null | undefined>();
      },
    });

    expectTypeOf(data).toMatchTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toMatchTypeOf<Promise<FetchResult<Mutation>>>();
  });

  test("uses masked/unmasked type when using Masked<TData>", async () => {
    type UserFieldsFragment = {
      __typename: "User";
      age: number;
    } & { " $fragmentName": "UserFieldsFragment" };

    type Mutation = {
      updateUser: {
        __typename: "User";
        id: string;
      } & { " $fragmentRefs": { UserFieldsFragment: UserFieldsFragment } };
    };

    type UnmaskedMutation = {
      updateUser: {
        __typename: "User";
        id: string;
        age: number;
      };
    };

    interface Variables {
      id: string;
    }

    const mutation: TypedDocumentNode<Masked<Mutation>, Variables> = gql`
      mutation ($id: ID!) {
        updateUser(id: $id) {
          id
          ...UserFields
        }
      }

      fragment UserFields on User {
        age
      }
    `;

    const [mutate, { data }] = useMutation(mutation, {
      optimisticResponse: {
        updateUser: { __typename: "User", id: "1", age: 30 },
      },
      updateQueries: {
        TestQuery: (_, { mutationResult }) => {
          expectTypeOf(mutationResult.data).toMatchTypeOf<
            UnmaskedMutation | null | undefined
          >();

          return {};
        },
      },
      refetchQueries(result) {
        expectTypeOf(result.data).toMatchTypeOf<
          UnmaskedMutation | null | undefined
        >();

        return "active";
      },
      onCompleted(data) {
        expectTypeOf(data).toMatchTypeOf<Mutation>();
      },
      update(_, result) {
        expectTypeOf(result.data).toMatchTypeOf<
          UnmaskedMutation | null | undefined
        >();
      },
    });

    expectTypeOf(data).toMatchTypeOf<Mutation | null | undefined>();
    expectTypeOf(mutate()).toMatchTypeOf<Promise<FetchResult<Mutation>>>();
  });
});
