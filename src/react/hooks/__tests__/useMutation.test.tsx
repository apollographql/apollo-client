import React, { useEffect } from "react";
import { GraphQLError } from "graphql";
import gql from "graphql-tag";
import { act } from "@testing-library/react";
import { render, waitFor, screen, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import fetchMock from "fetch-mock";

import {
  ApolloClient,
  ApolloError,
  ApolloLink,
  ApolloQueryResult,
  Cache,
  NetworkStatus,
  Observable,
  ObservableQuery,
  TypedDocumentNode,
} from "../../../core";
import { InMemoryCache } from "../../../cache";
import {
  MockedProvider,
  MockSubscriptionLink,
  mockSingleLink,
  MockedResponse,
  MockLink,
} from "../../../testing";
import { ApolloProvider } from "../../context";
import { useQuery } from "../useQuery";
import { useMutation } from "../useMutation";
import { BatchHttpLink } from "../../../link/batch-http";
import { FetchResult } from "../../../link/core";
import { spyOnConsole } from "../../../testing/internal";
import { expectTypeOf } from "expect-type";
import { Masked } from "../../../masking";
import {
  disableActEnvironment,
  createRenderStream,
  renderHookToSnapshotStream,
} from "@testing-library/react-render-stream";
import { MutationTuple, QueryResult } from "../../types/types";
import { invariant } from "../../../utilities/globals";

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

  describe("General use", () => {
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
        },
      ];

      const { result } = renderHook(() => useMutation(CREATE_TODO_MUTATION), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const createTodo = result.current[0];
      act(() => void createTodo({ variables }));
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitFor(
        () => {
          expect(result.current[1].loading).toBe(false);
        },
        { interval: 1 }
      );
      expect(result.current[1].data).toEqual(CREATE_TODO_RESULT);
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
        },
      ];

      const useCreateTodo = () => {
        const [createTodo, { loading, data }] =
          useMutation(CREATE_TODO_MUTATION);
        useEffect(() => {
          void createTodo({ variables });
        }, [variables]);

        return { loading, data };
      };

      const { result } = renderHook(() => useCreateTodo(), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { interval: 1 }
      );
      expect(result.current.data).toEqual(CREATE_TODO_RESULT);
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
        },
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: variables2,
          },
          result: { data: data2 },
        },
      ];

      const { result, rerender } = renderHook(
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

      const createTodo = result.current[0];
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toBe(undefined);

      act(() => void createTodo());
      expect(createTodo).toBe(result.current[0]);
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitFor(
        () => {
          expect(result.current[1].loading).toBe(false);
        },
        { interval: 1 }
      );
      expect(result.current[0]).toBe(createTodo);
      expect(result.current[1].data).toEqual(data1);

      rerender({ variables: variables2 });
      act(() => void createTodo());

      await waitFor(
        () => {
          expect(result.current[1].loading).toBe(false);
        },
        { interval: 1 }
      );
      expect(result.current[0]).toBe(createTodo);
      expect(result.current[1].data).toEqual(data2);
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
        await result.current.reset();
      });

      expect(consoleSpies.error).not.toHaveBeenCalled();
    });

    it("should resolve mutate function promise with mutation results", async () => {
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

      const { result } = renderHook(() => useMutation(CREATE_TODO_MUTATION), {
        wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>{children}</MockedProvider>
        ),
      });

      await act(async () => {
        await expect(result.current[0]({ variables })).resolves.toEqual({
          data: CREATE_TODO_RESULT,
        });
      });
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
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          },
        ];

        const onError = jest.fn();
        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { onError }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

        const createTodo = result.current[0];
        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult.data).toBe(undefined);
        expect(fetchResult.errors.message).toBe(CREATE_TODO_ERROR);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toBe(CREATE_TODO_ERROR);
      });

      it("should reject when there’s only an error and no error policy is set", async () => {
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
          },
        ];

        const { result } = renderHook(() => useMutation(CREATE_TODO_MUTATION), {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        });

        const createTodo = result.current[0];
        let fetchError: any;
        await act(async () => {
          // need to call createTodo this way to get “act” warnings to go away.
          try {
            await createTodo({ variables });
          } catch (err) {
            fetchError = err;
            return;
          }

          throw new Error("function did not error");
        });

        expect(fetchError).toEqual(
          new ApolloError({ graphQLErrors: [{ message: CREATE_TODO_ERROR }] })
        );
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
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          },
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: "none" }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

        const createTodo = result.current[0];
        await act(async () => {
          await expect(createTodo({ variables })).rejects.toThrow(
            CREATE_TODO_ERROR
          );
        });
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
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          },
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: "all" }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

        const createTodo = result.current[0];

        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult.data).toEqual(CREATE_TODO_RESULT);
        expect(fetchResult.errors[0].message).toEqual(CREATE_TODO_ERROR);
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
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          },
        ];

        const onError = jest.fn();
        const onCompleted = jest.fn();

        const { result } = renderHook(
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

        const createTodo = result.current[0];

        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult.data).toEqual(CREATE_TODO_RESULT);
        expect(fetchResult.errors[0].message).toEqual(CREATE_TODO_ERROR);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][0].message).toBe(CREATE_TODO_ERROR);
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
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          },
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: "ignore" }),
          {
            wrapper: ({ children }) => (
              <MockedProvider mocks={mocks}>{children}</MockedProvider>
            ),
          }
        );

        const createTodo = result.current[0];
        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult).toEqual({});
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
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          },
        ];

        const onError = jest.fn();

        const { result } = renderHook(
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

        const createTodo = result.current[0];
        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult).toEqual({});
        expect(onError).not.toHaveBeenCalled();
      });
    });

    it("should return the current client instance in the result object", async () => {
      const { result } = renderHook(() => useMutation(CREATE_TODO_MUTATION), {
        wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
      });
      expect(result.current[1].client).toBeInstanceOf(ApolloClient);
    });

    it("should call client passed to execute function", async () => {
      const { result } = renderHook(() => useMutation(CREATE_TODO_MUTATION), {
        wrapper: ({ children }) => <MockedProvider>{children}</MockedProvider>,
      });

      const link = mockSingleLink();
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link,
      });

      const mutateSpy = jest.spyOn(client, "mutate").mockImplementation(
        () =>
          new Promise((resolve) => {
            resolve({ data: CREATE_TODO_RESULT });
          })
      );

      const createTodo = result.current[0];
      await act(async () => {
        await createTodo({ client });
      });

      expect(mutateSpy).toHaveBeenCalledTimes(1);
    });

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
        },
      ];

      const { result } = renderHook(
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

      const createTodo = result.current[0];
      let fetchResult: any;
      await act(async () => {
        fetchResult = await createTodo({
          variables: { description: "Get milk." },
        });
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
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
        },
      ];

      const { result } = renderHook(
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

      const createTodo = result.current[0];
      let fetchResult: any;
      await act(async () => {
        fetchResult = await createTodo({
          variables: { priority: "Low", description: "Get milk." },
        });
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
      expect(result.current[1].data).toEqual(CREATE_TODO_DATA);
      setTimeout(() => {
        result.current[1].reset();
      });

      await waitFor(
        () => {
          expect(result.current[1].data).toBe(undefined);
        },
        { interval: 1 }
      );
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
        expect(result.data).toBe(undefined);
        expect(result.loading).toBe(false);
        expect(result.called).toBe(false);
      }

      let fetchResult = createTodo({
        variables: { priority: "Low", description: "Get milk." },
      });

      {
        const [, result] = await takeSnapshot();
        // started loading
        expect(result.data).toBe(undefined);
        expect(result.loading).toBe(true);
        expect(result.called).toBe(true);
      }

      reset();

      {
        const [, result] = await takeSnapshot();
        // reset to initial value
        expect(result.data).toBe(undefined);
        expect(result.loading).toBe(false);
        expect(result.called).toBe(false);
      }

      expect(await fetchResult).toEqual({ data: CREATE_TODO_DATA });

      await expect(takeSnapshot).not.toRerender();
    });
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
        },
      ];

      const { result } = renderHook(
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

      const createTodo = result.current[0];
      let fetchResult: any;
      const onCompleted = jest.fn();
      const onError = jest.fn();
      await act(async () => {
        fetchResult = await createTodo({
          variables,
          onCompleted,
          onError,
        });
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
      expect(result.current[1].data).toEqual(CREATE_TODO_DATA);
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
        },
      ];

      const hookOnCompleted = jest.fn();

      const { result } = renderHook(
        () =>
          useMutation(CREATE_TODO_MUTATION, { onCompleted: hookOnCompleted }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

      const [createTodo] = result.current;
      const onCompleted = jest.fn();
      await act(async () => {
        await createTodo({ variables, onCompleted });
      });

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
        },
      ];

      const { result } = renderHook(
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

      const createTodo = result.current[0];
      let fetchResult: any;
      const onCompleted = jest.fn();
      const onError = jest.fn();
      await act(async () => {
        fetchResult = await createTodo({
          variables,
          onCompleted,
          onError,
        });
      });

      expect(fetchResult).toEqual({
        data: undefined,
        errors: new ApolloError({ graphQLErrors: errors }),
      });

      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        new ApolloError({ graphQLErrors: errors }),
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
            errors: [new GraphQLError(CREATE_TODO_ERROR)],
          },
        },
      ];

      const hookOnError = jest.fn();

      const { result } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION, { onError: hookOnError }),
        {
          wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>{children}</MockedProvider>
          ),
        }
      );

      const [createTodo] = result.current;
      const onError = jest.fn();
      await act(async () => {
        await createTodo({ variables, onError });
      });

      expect(onError).toHaveBeenCalledTimes(1);
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
        },
      ];

      const onCompleted = jest.fn();
      const onError = jest.fn();

      const { result, rerender } = renderHook(
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

      const createTodo = result.current[0];
      let fetchResult: any;

      const onError1 = jest.fn();
      rerender({ onCompleted, onError: onError1 });
      await act(async () => {
        fetchResult = await createTodo({
          variables,
        });
      });

      expect(fetchResult).toEqual({
        data: undefined,
        errors: new ApolloError({ graphQLErrors: errors }),
      });

      expect(onCompleted).toHaveBeenCalledTimes(0);
      expect(onError).toHaveBeenCalledTimes(0);
      expect(onError1).toHaveBeenCalledTimes(1);
      expect(onError1).toHaveBeenCalledWith(
        new ApolloError({ graphQLErrors: errors }),
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
        },
      ];

      const onCompleted = jest.fn();
      const { result, rerender } = renderHook(
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

      const onCompleted1 = jest.fn();
      rerender({ onCompleted: onCompleted1 });
      const createTodo = result.current[0];
      let fetchResult: any;
      await act(async () => {
        fetchResult = await createTodo({
          variables,
        });
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
      expect(result.current[1].data).toEqual(CREATE_TODO_DATA);
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
        },
      ];

      const onCompleted = jest.fn();

      const { result, rerender } = renderHook(
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

      const createTodo = result.current[0];
      let fetchResult: any;

      const onCompleted1 = jest.fn();
      rerender({ onCompleted: onCompleted1 });

      await act(async () => {
        fetchResult = await createTodo({
          variables,
        });
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
      expect(result.current[1].data).toEqual(CREATE_TODO_DATA);
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
        })
    );

    const mutation = gql`
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

      const { result } = renderHook(() => useMutation(mutation), {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      });

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const mutate = result.current[0];

      let mutationResult: any;
      act(() => {
        mutationResult = mutate({
          update(
            cache,
            {
              data: {
                doSomething: { __typename, time },
              },
            }
          ) {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
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
        }).then(
          ({
            data: {
              doSomething: { __typename, time },
            },
          }) => {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
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
          }
        );
        mutationResult.catch(() => {});
      });

      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBeDefined();

      const {
        doSomething: { __typename, time },
      } = result.current[1].data;
      expect(__typename).toBe("MutationPayload");
      expect(time).toBeInstanceOf(Date);
      expect(time.getTime()).toBe(startTime);

      await expect(mutationResult).resolves.toBe(undefined);
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

      const { result } = renderHook(
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

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const mutate = result.current[0];

      let mutationResult: any;
      act(() => {
        mutationResult = mutate({
          update(
            cache,
            {
              data: {
                doSomething: { __typename, time },
              },
            }
          ) {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
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
        }).then(
          ({
            data: {
              doSomething: { __typename, time },
            },
          }) => {
            expect(__typename).toBe("MutationPayload");
            expect(time).toBeInstanceOf(Date);
            expect(time.getTime()).toBe(startTime);
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
          }
        );
      });

      mutationResult.catch(() => {});
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBeDefined();

      const {
        doSomething: { __typename, time },
      } = result.current[1].data;
      expect(__typename).toBe("MutationPayload");
      expect(time).toBeInstanceOf(Date);
      expect(time.getTime()).toBe(startTime);

      await expect(mutationResult).resolves.toBe(undefined);
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
        },
      ];

      const link = mockSingleLink(...mocks);
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link,
      });

      let renderCount = 0;
      const Component = () => {
        const [createTodo, { loading, data }] = useMutation(
          CREATE_TODO_MUTATION,
          { optimisticResponse }
        );

        switch (renderCount) {
          case 0:
            expect(loading).toBeFalsy();
            expect(data).toBeUndefined();
            void createTodo({ variables });

            const dataInStore = client.cache.extract(true);
            expect(dataInStore["Todo:1"]).toEqual(
              optimisticResponse.createTodo
            );

            break;
          case 1:
            expect(loading).toBeTruthy();
            expect(data).toBeUndefined();
            break;
          case 2:
            expect(loading).toBeFalsy();
            expect(data).toEqual(CREATE_TODO_RESULT);
            break;
          default:
        }
        renderCount += 1;
        return null;
      };

      render(
        <ApolloProvider client={client}>
          <Component />
        </ApolloProvider>
      );

      await waitFor(() => {
        expect(renderCount).toBe(3);
      });
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
        expect(finishedReobserving).toBe(true);
        expect(onUpdateResult.diff).toEqual({
          complete: true,
          result: {
            todoCount: 1,
          },
        });
        expect(onUpdateResult.result).toEqual({
          loading: false,
          networkStatus: NetworkStatus.ready,
          data: {
            todoCount: 1,
          },
        });
      });

      onUpdatePromise.catch(() => {});

      let finishedReobserving = false;
      const { result } = renderHook(
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

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 0 });
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].data).toBe(undefined);
      const createTodo = result.current.mutation[0];
      act(() => {
        void createTodo({
          variables,
          async onQueryUpdated(obsQuery, diff) {
            const result = await obsQuery.reobserve();
            finishedReobserving = true;
            resolveOnUpdate({ obsQuery, diff, result });
            return result;
          },
        });
      });

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 0 });
      expect(result.current.mutation[1].loading).toBe(true);
      expect(result.current.mutation[1].data).toBe(undefined);
      expect(finishedReobserving).toBe(false);

      await waitFor(
        () => {
          expect(result.current.query.data).toEqual({ todoCount: 1 });
        },
        { interval: 1 }
      );
      expect(result.current.query.loading).toBe(false);
      expect(result.current.mutation[1].loading).toBe(true);
      expect(result.current.mutation[1].data).toBe(undefined);

      await waitFor(
        () => {
          expect(result.current.mutation[1].loading).toBe(false);
        },
        { interval: 1 }
      );
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 1 });
      expect(result.current.mutation[1].data).toEqual(CREATE_TODO_RESULT);
      expect(finishedReobserving).toBe(true);

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
          useQueryResult: null as QueryResult<TNumbersQuery> | null,
          useMutationResult: null as MutationTuple<any, any> | null,
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
        const { data } = useQuery(QUERY_1);
        const [mutate] = useMutation(MUTATION_1, {
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
        expect(fetchResult.errors.message).toBe(CREATE_TODO_ERROR);
      });
      await waitFor(() => {
        expect(fetchResult.data).toBe(undefined);
      });
      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(onError.mock.calls[0][0].message).toBe(CREATE_TODO_ERROR);
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
        () => useMutation(CREATE_TODO_MUTATION_DEFER, { update }),
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
