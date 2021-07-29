import React, { useEffect } from 'react';
import { GraphQLError } from 'graphql';
import gql from 'graphql-tag';
import { act, render, wait } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { ApolloClient, ApolloLink, ApolloQueryResult, Cache, NetworkStatus, Observable, ObservableQuery, TypedDocumentNode } from '../../../core';
import { InMemoryCache } from '../../../cache';
import { itAsync, MockedProvider, mockSingleLink } from '../../../testing';
import { ApolloProvider } from '../../context';
import { useQuery } from '../useQuery';
import { useMutation } from '../useMutation';

describe('useMutation Hook', () => {
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
      description: 'Get milk!',
      priority: 'High',
      __typename: 'Todo'
    }
  };

  const CREATE_TODO_ERROR = 'Failed to create item';

  describe('General use', () => {
    it('should handle a simple mutation properly', async () => {
      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const { result, waitForNextUpdate } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const createTodo = result.current[0];
      act(() => void createTodo({ variables }));
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toEqual(CREATE_TODO_RESULT);
    });

    it('should be able to call mutations as an effect', async () => {
      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const useCreateTodo = () => {
        const [createTodo, { loading, data }] = useMutation(
          CREATE_TODO_MUTATION
        );
        useEffect(() => {
          createTodo({ variables });
        }, [variables]);

        return { loading, data };
      };

      const { result, waitForNextUpdate } = renderHook(
        () => useCreateTodo(),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      // TODO: This misses the first update for some reason.
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(CREATE_TODO_RESULT);
    });

    it('should ensure the mutation callback function has a stable identity', async () => {
      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const { result, waitForNextUpdate } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      const createTodo = result.current[0];
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      act(() => void createTodo({ variables }));
      expect(createTodo).toBe(result.current[0]);
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(createTodo).toBe(result.current[0]);
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].data).toEqual(CREATE_TODO_RESULT);
    });

    it('should resolve mutate function promise with mutation results', async () => {
      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const { result } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      await act(async () => {
        await expect(result.current[0]({ variables })).resolves.toEqual({
          data: CREATE_TODO_RESULT,
        });
      });
    });

    describe('mutate function upon error', () => {
      it('resolves with the resulting data and errors', async () => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables
            },
            result: {
              data: CREATE_TODO_RESULT,
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          }
        ];

        const onError = jest.fn();
        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { onError }),
          { wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          )},
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

      it(`should reject when errorPolicy is 'none'`, async () => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables
            },
            result: {
              data: CREATE_TODO_RESULT,
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          }
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: 'none' }),
          { wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          )},
        );

        const createTodo = result.current[0];
        await act(async () => {
          await expect(createTodo({ variables })).rejects.toThrow(CREATE_TODO_ERROR);
        });
      });

      it(`should resolve with 'data' and 'error' properties when errorPolicy is 'all'`, async () => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables
            },
            result: {
              data: CREATE_TODO_RESULT,
              errors: [new GraphQLError(CREATE_TODO_ERROR)],
            },
          }
        ];

        const { result } = renderHook(
          () => useMutation(CREATE_TODO_MUTATION, { errorPolicy: 'all' }),
          { wrapper: ({ children }) => (
            <MockedProvider mocks={mocks}>
              {children}
            </MockedProvider>
          )},
        );

        const createTodo = result.current[0];

        let fetchResult: any;
        await act(async () => {
          fetchResult = await createTodo({ variables });
        });

        expect(fetchResult.data).toEqual(CREATE_TODO_RESULT);
        expect(fetchResult.errors[0].message).toEqual(CREATE_TODO_ERROR);
      })
    });

    it('should return the current client instance in the result object', async () => {
      const { result } = renderHook(
        () => useMutation(CREATE_TODO_MUTATION),
        { wrapper: ({ children }) => (
          <MockedProvider>
            {children}
          </MockedProvider>
        )},
      );
      expect(result.current[1].client).toBeInstanceOf(ApolloClient);
    });

    it('should merge provided variables', async () => {
      const CREATE_TODO_DATA = {
        createTodo: {
          id: 1,
          description: 'Get milk!',
          priority: 'Low',
          __typename: 'Todo',
        },
      };
      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables: {
              priority: 'Low',
              description: 'Get milk.'
            }
          },
          result: {
            data: CREATE_TODO_DATA,
          }
        }
      ];

      const { result } = renderHook(
        () => useMutation<
          { createTodo: Todo },
          { priority?: string, description?: string }
        >(CREATE_TODO_MUTATION, {
          variables: { priority: 'Low' }
        }),
        { wrapper: ({ children }) => (
          <MockedProvider mocks={mocks}>
            {children}
          </MockedProvider>
        )},
      );

      const createTodo = result.current[0];
      let fetchResult: any;
      await act(async () => {
        fetchResult = await createTodo({ variables: { description: 'Get milk.' }});
      });

      expect(fetchResult).toEqual({ data: CREATE_TODO_DATA });
    });
  });

  describe('ROOT_MUTATION cache data', () => {
    const startTime = Date.now();
    const link = new ApolloLink(operation => new Observable(observer => {
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
    }));

    const mutation = gql`
      mutation DoSomething {
        doSomething {
          time
        }
      }
    `;

    it('should be removed by default after the mutation', async () => {
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

      const { result, waitForNextUpdate } = renderHook(
        () => useMutation(mutation),
        { wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        )},
      );

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const mutate = result.current[0];

      let mutationResult: any
      act(() => {
        mutationResult = mutate({
          update(cache, {
            data: {
              doSomething: {
                __typename,
                time,
              },
            },
          }) {
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
        }).then(({
          data: {
            doSomething: {
              __typename,
              time,
            },
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
        });
        mutationResult.catch(() => {});
      });

      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBeDefined();

      const {
        doSomething: {
          __typename,
          time,
        },
      } = result.current[1].data;
      expect(__typename).toBe('MutationPayload');
      expect(time).toBeInstanceOf(Date);
      expect(time.getTime()).toBe(startTime);

      await expect(mutationResult).resolves.toBe(undefined);
    });

    it('can be preserved by passing keepRootFields: true', async () => {
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

      const { result, waitForNextUpdate } = renderHook(
        () => useMutation(mutation, {
          keepRootFields: true,
        }),
        { wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        )},
      );

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(false);
      expect(result.current[1].data).toBe(undefined);
      const mutate = result.current[0];

      let mutationResult: any
      act(() => {
        mutationResult = mutate({
          update(cache, {
            data: {
              doSomething: {
                __typename,
                time,
              },
            },
          }) {
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
        }).then(({
          data: {
            doSomething: {
              __typename,
              time,
            },
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
        });
      });

      mutationResult.catch(() => {});
      expect(result.current[1].loading).toBe(true);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBe(undefined);

      await waitForNextUpdate();
      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].called).toBe(true);
      expect(result.current[1].data).toBeDefined();

      const {
        doSomething: {
          __typename,
          time,
        },
      } = result.current[1].data;
      expect(__typename).toBe('MutationPayload');
      expect(time).toBeInstanceOf(Date);
      expect(time.getTime()).toBe(startTime);

      await expect(mutationResult).resolves.toBe(undefined);
    });
  });

  describe('Update function', () => {
    it('should be called with the provided variables', async () => {
      const variables = { description: 'Get milk!' };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      let variablesMatched = false;
      const Component = () => {
        const [createTodo] = useMutation(
          CREATE_TODO_MUTATION,
          {
            update(_, __, options) {
              expect(options.variables).toEqual(variables);
              variablesMatched = true;
            }
          }
        );

        useEffect(() => {
          createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      await wait(() => expect(variablesMatched).toBe(true));
    });

    itAsync('should be called with the provided context', (resolve, reject) => {
      const context = { id: 3 };

      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      let foundContext = false;
      const Component = () => {
        const [createTodo] = useMutation<Todo, { description: string }, { id: number }>(
          CREATE_TODO_MUTATION,
          {
            context,
            update(_, __, options) {
              expect(options.context).toEqual(context);
              foundContext = true;
            }
          }
        );

        useEffect(() => {
          createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      return wait(() => {
        expect(foundContext).toBe(true);
      }).then(resolve, reject);
    });

    describe('If context is not provided', () => {
      itAsync('should be undefined', (resolve, reject) => {
        const variables = {
          description: 'Get milk!'
        };

        const mocks = [
          {
            request: {
              query: CREATE_TODO_MUTATION,
              variables
            },
            result: { data: CREATE_TODO_RESULT }
          }
        ];

        let checkedContext = false;
        const Component = () => {
          const [createTodo] = useMutation(
            CREATE_TODO_MUTATION,
            {
              update(_, __, options) {
                expect(options.context).toBeUndefined();
                checkedContext = true;
              }
            }
          );

          useEffect(() => {
            createTodo({ variables });
          }, []);

          return null;
        };

        render(
          <MockedProvider mocks={mocks}>
            <Component />
          </MockedProvider>
        );

        return wait(() => {
          expect(checkedContext).toBe(true);
        }).then(resolve, reject);
      });
    });
  });

  describe('Optimistic response', () => {
    itAsync('should support optimistic response handling', async (resolve, reject) => {
      const optimisticResponse = {
        __typename: 'Mutation',
        createTodo: {
          id: 1,
          description: 'TEMPORARY',
          priority: 'High',
          __typename: 'Todo'
        }
      };

      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const link = mockSingleLink(...mocks).setOnError(reject);
      const cache = new InMemoryCache();
      const client = new ApolloClient({
        cache,
        link
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
            createTodo({ variables });

            const dataInStore = client.cache.extract(true);
            expect(dataInStore['Todo:1']).toEqual(
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

      return wait(() => {
        expect(renderCount).toBe(3);
      }).then(resolve, reject);
    });

    itAsync('should be called with the provided context', async (resolve, reject) => {
      const optimisticResponse = {
        __typename: 'Mutation',
        createTodo: {
          id: 1,
          description: 'TEMPORARY',
          priority: 'High',
          __typename: 'Todo'
        }
      };

      const context = { id: 3 };

      const variables = {
        description: 'Get milk!'
      };

      const mocks = [
        {
          request: {
            query: CREATE_TODO_MUTATION,
            variables
          },
          result: { data: CREATE_TODO_RESULT }
        }
      ];

      const contextFn = jest.fn();

      const Component = () => {
        const [createTodo] = useMutation(
          CREATE_TODO_MUTATION,
          {
            optimisticResponse,
            context,
            update(_, __, options) {
              contextFn(options.context);
            }
          }
        );

        useEffect(() => {
          createTodo({ variables });
        }, []);

        return null;
      };

      render(
        <MockedProvider mocks={mocks}>
          <Component />
        </MockedProvider>
      );

      return wait(() => {
        expect(contextFn).toHaveBeenCalledTimes(2);
        expect(contextFn).toHaveBeenCalledWith(context);
      }).then(resolve, reject);
    });
  });

  describe('refetching queries', () => {
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
          description: 'Walk the dog',
          priority: 'Medium',
          __typename: 'Todo'
        },
        {
          id: 3,
          description: 'Call mom',
          priority: 'Low',
          __typename: 'Todo'
        },
      ],
    };

    const GET_TODOS_RESULT_2 = {
      todos: [
        {
          id: 1,
          description: 'Get milk!',
          priority: 'High',
          __typename: 'Todo'
        },
        {
          id: 2,
          description: 'Walk the dog',
          priority: 'Medium',
          __typename: 'Todo'
        },
        {
          id: 3,
          description: 'Call mom',
          priority: 'Low',
          __typename: 'Todo'
        },
      ],
    };

    it('can pass onQueryUpdated to useMutation', async () => {
      interface TData {
        todoCount: number;
      }
      const countQuery: TypedDocumentNode<TData> = gql`
        query Count { todoCount @client }
      `;

      const optimisticResponse = {
        __typename: 'Mutation',
        createTodo: {
          id: 1,
          description: 'TEMPORARY',
          priority: 'High',
          __typename: 'Todo'
        }
      };

      const variables = {
        description: 'Get milk!'
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
      const onUpdatePromise = new Promise<OnQueryUpdatedResults>(resolve => {
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
      const { result, waitForNextUpdate } = renderHook(() => ({
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
      }), {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>
            {children}
          </ApolloProvider>
        ),
      });

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 0 });
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].data).toBe(undefined);
      const createTodo = result.current.mutation[0];
      act(() => {
        createTodo({
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

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual({ todoCount: 1 });
      expect(result.current.mutation[1].loading).toBe(false);
      expect(result.current.mutation[1].data).toEqual(CREATE_TODO_RESULT);
      expect(finishedReobserving).toBe(true);

      await expect(onUpdatePromise).resolves.toBe(undefined);
    });

    it('refetchQueries with operation names should update cache', async () => {
      const variables = { description: 'Get milk!' };
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

      const { result, waitForNextUpdate } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      setTimeout(() => {
        act(() => {
          mutate({
            variables,
            refetchQueries: ['getTodos'],
          });
        });
      });

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[2].result.data);

      expect(client.readQuery({ query: GET_TODOS_QUERY}))
        .toEqual(mocks[2].result.data);
    });

    it('refetchQueries with document nodes should update cache', async () => {
      const variables = { description: 'Get milk!' };
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

      const { result, waitForNextUpdate } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      setTimeout(() => {
        act(() => {
          mutate({
            variables,
            refetchQueries: [GET_TODOS_QUERY],
          });
        });
      });

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[2].result.data);
      expect(client.readQuery({ query: GET_TODOS_QUERY }))
        .toEqual(mocks[2].result.data);
    });

    it('refetchQueries should update cache after unmount', async () => {
      const variables = { description: 'Get milk!' };
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

      const { result, waitForNextUpdate, unmount } = renderHook(
        () => ({
          query: useQuery(GET_TODOS_QUERY),
          mutation: useMutation(CREATE_TODO_MUTATION),
        }),
        {
          wrapper: ({ children }) => (
            <ApolloProvider client={client}>
              {children}
            </ApolloProvider>
          ),
        },
      );

      expect(result.current.query.loading).toBe(true);
      expect(result.current.query.data).toBe(undefined);
      await waitForNextUpdate();

      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);
      const mutate = result.current.mutation[0];
      let updateResolve: Function;
      const updatePromise = new Promise((resolve) => (updateResolve = resolve));
      setTimeout(() => {
        act(() => {
          mutate({
            variables,
            refetchQueries: ['getTodos'],
            update() {
              unmount();
              updateResolve();
            },
          });
        });
      });

      await waitForNextUpdate();
      expect(result.current.query.loading).toBe(false);
      expect(result.current.query.data).toEqual(mocks[0].result.data);
      await updatePromise;
      await new Promise((resolve) => setTimeout(resolve));
      expect(client.readQuery({ query: GET_TODOS_QUERY }))
        .toEqual(mocks[2].result.data);
    });
  });
});
