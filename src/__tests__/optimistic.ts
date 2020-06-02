import { from, ObservableInput } from 'rxjs';
import { take, toArray, map } from 'rxjs/operators';
import { assign, cloneDeep } from 'lodash';
import gql from 'graphql-tag';

import { mockSingleLink } from '../utilities/testing/mocking/mockLink';
import { MutationQueryReducersMap } from '../core/types';
import { ObservableSubscription as Subscription } from '../utilities/observables/Observable';
import { ApolloClient } from '../';
import { addTypenameToDocument } from '../utilities/graphql/transform';
import { makeReference } from '../core';
import { stripSymbols } from '../utilities/testing/stripSymbols';
import { itAsync } from '../utilities/testing/itAsync';
import { InMemoryCache } from '../cache/inmemory/inMemoryCache';
import { QueryManager } from '../core/QueryManager';

describe('optimistic mutation results', () => {
  const query = gql`
    query todoList {
      __typename
      todoList(id: 5) {
        __typename
        id
        todos {
          id
          __typename
          text
          completed
        }
        filteredTodos: todos(completed: true) {
          id
          __typename
          text
          completed
        }
      }
      noIdList: todoList(id: 6) {
        __typename
        id
        todos {
          __typename
          text
          completed
        }
      }
    }
  `;

  const result: any = {
    data: {
      __typename: 'Query',
      todoList: {
        __typename: 'TodoList',
        id: '5',
        todos: [
          {
            __typename: 'Todo',
            id: '3',
            text: 'Hello world',
            completed: false,
          },
          {
            __typename: 'Todo',
            id: '6',
            text: 'Second task',
            completed: false,
          },
          {
            __typename: 'Todo',
            id: '12',
            text: 'Do other stuff',
            completed: false,
          },
        ],
        filteredTodos: [],
      },
      noIdList: {
        __typename: 'TodoList',
        id: '7',
        todos: [
          {
            __typename: 'Todo',
            text: 'Hello world',
            completed: false,
          },
          {
            __typename: 'Todo',
            text: 'Second task',
            completed: false,
          },
          {
            __typename: 'Todo',
            text: 'Do other stuff',
            completed: false,
          },
        ],
      },
    },
  };

  async function setup(
    reject: (reason: any) => any,
    ...mockedResponses: any[]
  ) {
    const link = mockSingleLink({
      request: { query },
      result,
    }, ...mockedResponses).setOnError(reject);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        typePolicies: {
          TodoList: {
            fields: {
              todos: {
                // Deliberately silence "Cache data may be lost..."
                // warnings by favoring the incoming data, rather than
                // (say) concatenating the arrays together.
                merge(_, incoming) {
                  return incoming;
                },
              },
            },
          },
        },
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
      }),
    });

    const obsHandle = client.watchQuery({ query });
    await obsHandle.result();

    return client;
  }

  describe('error handling', () => {
    const mutation = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          id
          text
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        createTodo: {
          __typename: 'Todo',
          id: '99',
          text: 'This one was created with a mutation.',
          completed: true,
        },
      },
    };

    const mutationResult2 = {
      data: assign({}, mutationResult.data, {
        createTodo: assign({}, mutationResult.data.createTodo, {
          id: '66',
          text: 'Second mutation.',
        }),
      }),
    };

    const optimisticResponse = {
      __typename: 'Mutation',
      createTodo: {
        __typename: 'Todo',
        id: '99',
        text: 'Optimistically generated',
        completed: true,
      },
    };

    const optimisticResponse2 = assign({}, optimisticResponse, {
      createTodo: assign({}, optimisticResponse.createTodo, {
        id: '66',
        text: 'Optimistically generated 2',
      }),
    });

    describe('with `updateQueries`', () => {
      const updateQueries = {
        todoList: (prev: any, options: any) => {
          const state = cloneDeep(prev);
          state.todoList.todos.unshift(options.mutationResult.data.createTodo);
          return state;
        },
      };

      itAsync('handles a single error for a single mutation', async (resolve, reject) => {
        expect.assertions(6);
        const client = await setup(reject, {
          request: { query: mutation },
          error: new Error('forbidden (test error)'),
        });
        try {
          const promise = client.mutate({
            mutation,
            optimisticResponse,
            updateQueries,
          });

          const dataInStore = (client.cache as InMemoryCache).extract(true);
          expect((dataInStore['TodoList5'] as any).todos.length).toBe(4);
          expect((dataInStore['Todo99'] as any).text).toBe(
            'Optimistically generated',
          );
          await promise;
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('forbidden (test error)');

          const dataInStore = (client.cache as InMemoryCache).extract(true);
          expect((dataInStore['TodoList5'] as any).todos.length).toBe(3);
          expect(stripSymbols(dataInStore)).not.toHaveProperty('Todo99');
        }

        resolve();
      });

      itAsync('handles errors produced by one mutation in a series', async (resolve, reject) => {
        expect.assertions(10);
        let subscriptionHandle: Subscription;
        const client = await setup(
          reject,
          {
            request: { query: mutation },
            error: new Error('forbidden (test error)'),
          },
          {
            request: { query: mutation },
            result: mutationResult2,
          },
        );

        // we have to actually subscribe to the query to be able to update it
        await new Promise(resolve => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res: any) {
              resolve(res);
            },
          });
        });

        const promise = client
          .mutate({
            mutation,
            optimisticResponse,
            updateQueries,
          })
          .catch((err: any) => {
            // it is ok to fail here
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('forbidden (test error)');
            return null;
          });

        const promise2 = client.mutate({
          mutation,
          optimisticResponse: optimisticResponse2,
          updateQueries,
        });

        const dataInStore = (client.cache as InMemoryCache).extract(true);
        expect((dataInStore['TodoList5'] as any).todos.length).toBe(5);
        expect((dataInStore['Todo99'] as any).text).toBe(
          'Optimistically generated',
        );
        expect((dataInStore['Todo66'] as any).text).toBe(
          'Optimistically generated 2',
        );

        await Promise.all([promise, promise2]);

        subscriptionHandle!.unsubscribe();
        {
          const dataInStore = (client.cache as InMemoryCache).extract(true);
          expect((dataInStore['TodoList5'] as any).todos.length).toBe(4);
          expect(stripSymbols(dataInStore)).not.toHaveProperty('Todo99');
          expect(dataInStore).toHaveProperty('Todo66');
          expect((dataInStore['TodoList5'] as any).todos).toContainEqual(
            makeReference('Todo66'),
          );
          expect((dataInStore['TodoList5'] as any).todos).not.toContainEqual(
            makeReference('Todo99'),
          );
          resolve();
        }
      });

      itAsync('can run 2 mutations concurrently and handles all intermediate states well', async (resolve, reject) => {
        expect.assertions(34);
        function checkBothMutationsAreApplied(
          expectedText1: any,
          expectedText2: any,
        ) {
          const dataInStore = (client.cache as InMemoryCache).extract(true);
          expect((dataInStore['TodoList5'] as any).todos.length).toBe(5);
          expect(dataInStore).toHaveProperty('Todo99');
          expect(dataInStore).toHaveProperty('Todo66');
          // <any> can be removed once @types/chai adds deepInclude
          expect((dataInStore['TodoList5'] as any).todos).toContainEqual(
            makeReference('Todo66'),
          );
          expect((dataInStore['TodoList5'] as any).todos).toContainEqual(
            makeReference('Todo99'),
          );
          expect((dataInStore['Todo99'] as any).text).toBe(expectedText1);
          expect((dataInStore['Todo66'] as any).text).toBe(expectedText2);
        }
        let subscriptionHandle: Subscription;
        const client = await setup(
          reject,
          {
            request: { query: mutation },
            result: mutationResult,
          },
          {
            request: { query: mutation },
            result: mutationResult2,
            // make sure it always happens later
            delay: 100,
          },
        );
        // we have to actually subscribe to the query to be able to update it
        await new Promise(resolve => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res: any) {
              resolve(res);
            },
          });
        });

        const queryManager: QueryManager<any> = (client as any).queryManager;

        const promise = client
          .mutate({
            mutation,
            optimisticResponse,
            updateQueries,
          })
          .then((res: any) => {
            checkBothMutationsAreApplied(
              'This one was created with a mutation.',
              'Optimistically generated 2',
            );

            // @ts-ignore
            const latestState = queryManager.mutationStore;
            expect(latestState.get('1').loading).toBe(false);
            expect(latestState.get('2').loading).toBe(true);

            return res;
          });

        const promise2 = client
          .mutate({
            mutation,
            optimisticResponse: optimisticResponse2,
            updateQueries,
          })
          .then((res: any) => {
            checkBothMutationsAreApplied(
              'This one was created with a mutation.',
              'Second mutation.',
            );

            // @ts-ignore
            const latestState = queryManager.mutationStore;
            expect(latestState.get('1').loading).toBe(false);
            expect(latestState.get('2').loading).toBe(false);

            return res;
          });

        // @ts-ignore
        const mutationsState = queryManager.mutationStore;
        expect(mutationsState.get('1').loading).toBe(true);
        expect(mutationsState.get('2').loading).toBe(true);

        checkBothMutationsAreApplied(
          'Optimistically generated',
          'Optimistically generated 2',
        );

        await Promise.all([promise, promise2]);

        subscriptionHandle!.unsubscribe();
        checkBothMutationsAreApplied(
          'This one was created with a mutation.',
          'Second mutation.',
        );

        resolve();
      });
    });

    describe('with `update`', () => {
      const update = (proxy: any, mResult: any) => {
        const data: any = proxy.readFragment({
          id: 'TodoList5',
          fragment: gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `,
        });

        proxy.writeFragment({
          data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
          id: 'TodoList5',
          fragment: gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `,
        });
      };

      itAsync('handles a single error for a single mutation', async (resolve, reject) => {
        expect.assertions(6);

        const client = await setup(reject, {
          request: { query: mutation },
          error: new Error('forbidden (test error)'),
        });

        try {
          const promise = client.mutate({
            mutation,
            optimisticResponse,
            update,
          });

          const dataInStore = (client.cache as InMemoryCache).extract(true);
          expect((dataInStore['TodoList5'] as any).todos.length).toBe(4);
          expect((dataInStore['Todo99'] as any).text).toBe(
            'Optimistically generated',
          );

          await promise;
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('forbidden (test error)');

          const dataInStore = (client.cache as InMemoryCache).extract(true);
          expect((dataInStore['TodoList5'] as any).todos.length).toBe(3);
          expect(stripSymbols(dataInStore)).not.toHaveProperty('Todo99');
        }

        resolve();
      });

      itAsync('handles errors produced by one mutation in a series', async (resolve, reject) => {
        expect.assertions(10);
        let subscriptionHandle: Subscription;
        const client = await setup(
          reject,
          {
            request: { query: mutation },
            error: new Error('forbidden (test error)'),
          },
          {
            request: { query: mutation },
            result: mutationResult2,
          },
        );

        // we have to actually subscribe to the query to be able to update it
        await new Promise(resolve => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res: any) {
              resolve(res);
            },
          });
        });

        const promise = client
          .mutate({
            mutation,
            optimisticResponse,
            update,
          })
          .catch((err: any) => {
            // it is ok to fail here
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('forbidden (test error)');
            return null;
          });

        const promise2 = client.mutate({
          mutation,
          optimisticResponse: optimisticResponse2,
          update,
        });

        const dataInStore = (client.cache as InMemoryCache).extract(true);
        expect((dataInStore['TodoList5'] as any).todos.length).toBe(5);
        expect((dataInStore['Todo99'] as any).text).toBe(
          'Optimistically generated',
        );
        expect((dataInStore['Todo66'] as any).text).toBe(
          'Optimistically generated 2',
        );

        await Promise.all([promise, promise2]);

        subscriptionHandle!.unsubscribe();
        {
          const dataInStore = (client.cache as InMemoryCache).extract(true);
          expect((dataInStore['TodoList5'] as any).todos.length).toBe(4);
          expect(stripSymbols(dataInStore)).not.toHaveProperty('Todo99');
          expect(dataInStore).toHaveProperty('Todo66');
          expect((dataInStore['TodoList5'] as any).todos).toContainEqual(
            makeReference('Todo66'),
          );
          expect((dataInStore['TodoList5'] as any).todos).not.toContainEqual(
            makeReference('Todo99'),
          );
          resolve();
        }
      });

      itAsync('can run 2 mutations concurrently and handles all intermediate states well', async (resolve, reject) => {
        expect.assertions(34);
        function checkBothMutationsAreApplied(
          expectedText1: any,
          expectedText2: any,
        ) {
          const dataInStore = (client.cache as InMemoryCache).extract(true);
          expect((dataInStore['TodoList5'] as any).todos.length).toBe(5);
          expect(dataInStore).toHaveProperty('Todo99');
          expect(dataInStore).toHaveProperty('Todo66');
          expect((dataInStore['TodoList5'] as any).todos).toContainEqual(
            makeReference('Todo66'),
          );
          expect((dataInStore['TodoList5'] as any).todos).toContainEqual(
            makeReference('Todo99'),
          );
          expect((dataInStore['Todo99'] as any).text).toBe(expectedText1);
          expect((dataInStore['Todo66'] as any).text).toBe(expectedText2);
        }
        let subscriptionHandle: Subscription;

        const client = await setup(
          reject,
          {
            request: { query: mutation },
            result: mutationResult,
          },
          {
            request: { query: mutation },
            result: mutationResult2,
            // make sure it always happens later
            delay: 100,
          },
        );

        // we have to actually subscribe to the query to be able to update it
        await new Promise(resolve => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res: any) {
              resolve(res);
            },
          });
        });

        const promise = client
          .mutate({
            mutation,
            optimisticResponse,
            update,
          })
          .then((res: any) => {
            checkBothMutationsAreApplied(
              'This one was created with a mutation.',
              'Optimistically generated 2',
            );

            // @ts-ignore
            const latestState = client.queryManager.mutationStore;
            expect(latestState.get('1').loading).toBe(false);
            expect(latestState.get('2').loading).toBe(true);

            return res;
          });

        const promise2 = client
          .mutate({
            mutation,
            optimisticResponse: optimisticResponse2,
            update,
          })
          .then((res: any) => {
            checkBothMutationsAreApplied(
              'This one was created with a mutation.',
              'Second mutation.',
            );

            // @ts-ignore
            const latestState = client.queryManager.mutationStore;
            expect(latestState.get('1').loading).toBe(false);
            expect(latestState.get('2').loading).toBe(false);

            return res;
          });

        // @ts-ignore
        const mutationsState = client.queryManager.mutationStore;
        expect(mutationsState.get('1').loading).toBe(true);
        expect(mutationsState.get('2').loading).toBe(true);

        checkBothMutationsAreApplied(
          'Optimistically generated',
          'Optimistically generated 2',
        );

        await Promise.all([promise, promise2]);

        subscriptionHandle!.unsubscribe();
        checkBothMutationsAreApplied(
          'This one was created with a mutation.',
          'Second mutation.',
        );

        resolve();
      });
    });
  });

  describe('Apollo Client readQuery/readFragment optimistic results', () => {
    const todoListMutation = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          __typename
          id
          todos {
            id
            text
            completed
            __typename
          }
        }
      }
    `;

    const todoListMutationResult = {
      data: {
        __typename: 'Mutation',
        createTodo: {
          __typename: 'TodoList',
          id: '5',
          todos: [
            {
              __typename: 'Todo',
              id: '99',
              text: 'This one was created with a mutation.',
              completed: true,
            },
          ],
        },
      },
    };

    const todoListOptimisticResponse = {
      __typename: 'Mutation',
      createTodo: {
        __typename: 'TodoList',
        id: '5',
        todos: [
          {
            __typename: 'Todo',
            id: '99',
            text: 'Optimistically generated',
            completed: true,
          },
        ],
      },
    };

    const todoListQuery = gql`
      query todoList {
        todoList(id: 5) {
          __typename
          id
          todos {
            id
            __typename
            text
            completed
          }
        }
      }
    `;

    itAsync(
      'should read the optimistic response of a mutation when making an ' +
        'ApolloClient.readQuery() call, if the `optimistic` param is set to ' +
        'true',
      (resolve, reject) => {
        return setup(reject, {
          request: { query: todoListMutation },
          result: todoListMutationResult,
        }).then(client => {
          return client.mutate({
            mutation: todoListMutation,
            optimisticResponse: todoListOptimisticResponse,
            update: (proxy: any, mResult: any) => {
              const data = proxy.readQuery({ query: todoListQuery }, true);
              expect(data.todoList.todos[0].text).toEqual(
                todoListOptimisticResponse.createTodo.todos[0].text,
              );
            },
          });
        }).then(resolve, reject);
      },
    );

    itAsync(
      'should not read the optimistic response of a mutation when making ' +
        'an ApolloClient.readQuery() call, if the `optimistic` param is set ' +
        'to false',
      (resolve, reject) => {
        return setup(reject, {
          request: { query: todoListMutation },
          result: todoListMutationResult,
        }).then(client => {
          return client.mutate({
            mutation: todoListMutation,
            optimisticResponse: todoListOptimisticResponse,
            update: (proxy: any, mResult: any) => {
              const incomingText = mResult.data.createTodo.todos[0].text;
              const data = proxy.readQuery({ query: todoListQuery }, false);
              expect(data.todoList.todos[0].text).toEqual(incomingText);
            },
          });
        }).then(resolve, reject);
      },
    );

    const todoListFragment = gql`
      fragment todoList on TodoList {
        todos {
          id
          text
          completed
          __typename
        }
      }
    `;

    itAsync(
      'should read the optimistic response of a mutation when making an ' +
        'ApolloClient.readFragment() call, if the `optimistic` param is set ' +
        'to true',
      (resolve, reject) => {
        return setup(reject, {
          request: { query: todoListMutation },
          result: todoListMutationResult,
        }).then(client => {
          return client.mutate({
            mutation: todoListMutation,
            optimisticResponse: todoListOptimisticResponse,
            update: (proxy: any, mResult: any) => {
              const data: any = proxy.readFragment(
                {
                  id: 'TodoList5',
                  fragment: todoListFragment,
                },
                true,
              );
              expect(data.todos[0].text).toEqual(
                todoListOptimisticResponse.createTodo.todos[0].text,
              );
            },
          });
        }).then(resolve, reject);
      },
    );

    itAsync(
      'should not read the optimistic response of a mutation when making ' +
        'an ApolloClient.readFragment() call, if the `optimistic` param is ' +
        'set to false',
      (resolve, reject) => {
        return setup(reject, {
          request: { query: todoListMutation },
          result: todoListMutationResult,
        }).then(client => {
          return client.mutate({
            mutation: todoListMutation,
            optimisticResponse: todoListOptimisticResponse,
            update: (proxy: any, mResult: any) => {
              const incomingText = mResult.data.createTodo.todos[0].text;
              const data: any = proxy.readFragment(
                {
                  id: 'TodoList5',
                  fragment: todoListFragment,
                },
                false,
              );
              expect(data.todos[0].text).toEqual(incomingText);
            },
          });
        }).then(resolve, reject);
      },
    );
  });

  describe('passing a function to optimisticResponse', () => {
    const mutation = gql`
      mutation createTodo($text: String) {
        createTodo(text: $text) {
          id
          text
          completed
          __typename
        }
        __typename
      }
    `;

    const variables = { text: 'Optimistically generated from variables' };

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        createTodo: {
          id: '99',
          __typename: 'Todo',
          text: 'This one was created with a mutation.',
          completed: true,
        },
      },
    };

    const optimisticResponse = ({ text }: { text: string }) => ({
      __typename: 'Mutation',
      createTodo: {
        __typename: 'Todo',
        id: '99',
        text,
        completed: true,
      },
    });

    itAsync('will use a passed variable in optimisticResponse', async (resolve, reject) => {
      expect.assertions(6);
      let subscriptionHandle: Subscription;
      const client = await setup(reject, {
        request: { query: mutation, variables },
        result: mutationResult,
      });

      // we have to actually subscribe to the query to be able to update it
      await new Promise(resolve => {
        const handle = client.watchQuery({ query });
        subscriptionHandle = handle.subscribe({
          next(res: any) {
            resolve(res);
          },
        });
      });

      const promise = client.mutate({
        mutation,
        variables,
        optimisticResponse,
        update: (proxy: any, mResult: any) => {
          expect(mResult.data.createTodo.id).toBe('99');

          const id = 'TodoList5';
          const fragment = gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `;

          const data: any = proxy.readFragment({ id, fragment });

          proxy.writeFragment({
            data: {
              ...data,
              todos: [mResult.data.createTodo, ...data.todos],
            },
            id,
            fragment,
          });
        },
      });

      const dataInStore = (client.cache as InMemoryCache).extract(true);
      expect((dataInStore['TodoList5'] as any).todos.length).toEqual(4);
      expect((dataInStore['Todo99'] as any).text).toEqual(
        'Optimistically generated from variables',
      );

      await promise;

      const newResult: any = await client.query({ query });

      subscriptionHandle!.unsubscribe();
      // There should be one more todo item than before
      expect(newResult.data.todoList.todos.length).toEqual(4);

      // Since we used `prepend` it should be at the front
      expect(newResult.data.todoList.todos[0].text).toEqual(
        'This one was created with a mutation.',
      );

      resolve();
    });
  });

  describe('optimistic updates using `updateQueries`', () => {
    const mutation = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          id
          text
          completed
          __typename
        }
        __typename
      }
    `;

    type IMutationResult = {
      __typename: string;
      createTodo: {
        id: string;
        __typename: string;
        text: string;
        completed: boolean;
      };
    };

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        createTodo: {
          id: '99',
          __typename: 'Todo',
          text: 'This one was created with a mutation.',
          completed: true,
        },
      },
    };

    const optimisticResponse = {
      __typename: 'Mutation',
      createTodo: {
        __typename: 'Todo',
        id: '99',
        text: 'Optimistically generated',
        completed: true,
      },
    };

    const mutationResult2 = {
      data: assign({}, mutationResult.data, {
        createTodo: assign({}, mutationResult.data.createTodo, {
          id: '66',
          text: 'Second mutation.',
        }),
      }),
    };

    const optimisticResponse2 = {
      __typename: 'Mutation',
      createTodo: {
        __typename: 'Todo',
        id: '66',
        text: 'Optimistically generated 2',
        completed: true,
      },
    };

    itAsync('will insert a single itemAsync to the beginning', async (resolve, reject) => {
      expect.assertions(7);
      let subscriptionHandle: Subscription;
      const client = await setup(reject, {
        request: { query: mutation },
        result: mutationResult,
      });

      // we have to actually subscribe to the query to be able to update it
      await new Promise(resolve => {
        const handle = client.watchQuery({ query });
        subscriptionHandle = handle.subscribe({
          next(res: any) {
            resolve(res);
          },
        });
      });

      const promise = client.mutate({
        mutation,
        optimisticResponse,
        updateQueries: {
          todoList(prev: any, options: any) {
            const mResult = options.mutationResult as any;
            expect(mResult.data.createTodo.id).toEqual('99');
            return {
              ...prev,
              todoList: {
                ...prev.todoList,
                todos: [
                  mResult.data.createTodo,
                  ...prev.todoList.todos,
                ],
              },
            };
          },
        },
      });

      const dataInStore = (client.cache as InMemoryCache).extract(true);
      expect((dataInStore['TodoList5'] as any).todos.length).toEqual(4);
      expect((dataInStore['Todo99'] as any).text).toEqual(
        'Optimistically generated',
      );

      await promise;

      const newResult: any = await client.query({ query });

      subscriptionHandle!.unsubscribe();
      // There should be one more todo item than before
      expect(newResult.data.todoList.todos.length).toEqual(4);

      // Since we used `prepend` it should be at the front
      expect(newResult.data.todoList.todos[0].text).toEqual(
        'This one was created with a mutation.',
      );

      resolve();
    });

    itAsync('two array insert like mutations', async (resolve, reject) => {
      expect.assertions(9);
      let subscriptionHandle: Subscription;
      const client = await setup(
        reject,
        {
          request: { query: mutation },
          result: mutationResult,
        },
        {
          request: { query: mutation },
          result: mutationResult2,
          delay: 50,
        },
      );

      // we have to actually subscribe to the query to be able to update it
      await new Promise(resolve => {
        const handle = client.watchQuery({ query });
        subscriptionHandle = handle.subscribe({
          next(res: any) {
            resolve(res);
          },
        });
      });

      const updateQueries = {
        todoList: (prev, options) => {
          const mResult = options.mutationResult;

          const state = cloneDeep<any>(prev);

          if (mResult.data) {
            state.todoList.todos.unshift(mResult.data.createTodo);
          }

          return state;
        },
      } as MutationQueryReducersMap<IMutationResult>;
      const promise = client
        .mutate({
          mutation,
          optimisticResponse,
          updateQueries,
        })
        .then((res: any) => {
          const currentDataInStore = (client.cache as InMemoryCache).extract(
            true,
          );
          expect((currentDataInStore['TodoList5'] as any).todos.length).toEqual(
            5,
          );
          expect((currentDataInStore['Todo99'] as any).text).toEqual(
            'This one was created with a mutation.',
          );
          expect((currentDataInStore['Todo66'] as any).text).toEqual(
            'Optimistically generated 2',
          );
          return res;
        });

      const promise2 = client.mutate({
        mutation,
        optimisticResponse: optimisticResponse2,
        updateQueries,
      });

      const dataInStore = (client.cache as InMemoryCache).extract(true);
      expect((dataInStore['TodoList5'] as any).todos.length).toEqual(5);
      expect((dataInStore['Todo99'] as any).text).toEqual(
        'Optimistically generated',
      );
      expect((dataInStore['Todo66'] as any).text).toEqual(
        'Optimistically generated 2',
      );

      await Promise.all([promise, promise2]);

      const newResult: any = await client.query({ query });

      subscriptionHandle!.unsubscribe();
      // There should be one more todo item than before
      expect(newResult.data.todoList.todos.length).toEqual(5);

      // Since we used `prepend` it should be at the front
      expect(newResult.data.todoList.todos[0].text).toEqual('Second mutation.');
      expect(newResult.data.todoList.todos[1].text).toEqual(
        'This one was created with a mutation.',
      );

      resolve();
    });

    itAsync('two mutations, one fails', async (resolve, reject) => {
      expect.assertions(10);
      let subscriptionHandle: Subscription;
      const client = await setup(
        reject,
        {
          request: { query: mutation },
          error: new Error('forbidden (test error)'),
          delay: 20,
        },
        {
          request: { query: mutation },
          result: mutationResult2,
          // XXX this test will uncover a flaw in the design of optimistic responses combined with
          // updateQueries or result reducers if you un-comment the line below. The issue is that
          // optimistic updates are not commutative but are treated as such. When undoing an
          // optimistic update, other optimistic updates should be rolled back and re-applied in the
          // same order as before, otherwise the store can end up in an inconsistent state.
          // delay: 50,
        },
      );

      // we have to actually subscribe to the query to be able to update it
      await new Promise(resolve => {
        const handle = client.watchQuery({ query });
        subscriptionHandle = handle.subscribe({
          next(res: any) {
            resolve(res);
          },
        });
      });

      const updateQueries = {
        todoList: (prev, options) => {
          const mResult = options.mutationResult;

          const state = cloneDeep<any>(prev);

          if (mResult.data) {
            state.todoList.todos.unshift(mResult.data.createTodo);
          }

          return state;
        },
      } as MutationQueryReducersMap<IMutationResult>;
      const promise = client
        .mutate({
          mutation,
          optimisticResponse,
          updateQueries,
        })
        .catch((err: any) => {
          // it is ok to fail here
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toEqual('forbidden (test error)');
          return null;
        });

      const promise2 = client.mutate({
        mutation,
        optimisticResponse: optimisticResponse2,
        updateQueries,
      });

      const dataInStore = (client.cache as InMemoryCache).extract(true);
      expect((dataInStore['TodoList5'] as any).todos.length).toEqual(5);
      expect((dataInStore['Todo99'] as any).text).toEqual(
        'Optimistically generated',
      );
      expect((dataInStore['Todo66'] as any).text).toEqual(
        'Optimistically generated 2',
      );

      await Promise.all([promise, promise2]);

      subscriptionHandle!.unsubscribe();
      {
        const dataInStore = (client.cache as InMemoryCache).extract(true);
        expect((dataInStore['TodoList5'] as any).todos.length).toEqual(4);
        expect(stripSymbols(dataInStore)).not.toHaveProperty('Todo99');
        expect(dataInStore).toHaveProperty('Todo66');
        expect((dataInStore['TodoList5'] as any).todos).toContainEqual(
          makeReference('Todo66'),
        );
        expect((dataInStore['TodoList5'] as any).todos).not.toContainEqual(
          makeReference('Todo99'),
        );
        resolve();
      }
    });

    itAsync('will handle dependent updates', async (resolve, reject) => {
      expect.assertions(1);
      const link = mockSingleLink({
        request: { query },
        result,
      }, {
        request: { query: mutation },
        result: mutationResult,
        delay: 10,
      }, {
        request: { query: mutation },
        result: mutationResult2,
        delay: 20,
      }).setOnError(reject);

      const customOptimisticResponse1 = {
        __typename: 'Mutation',
        createTodo: {
          __typename: 'Todo',
          id: 'optimistic-99',
          text: 'Optimistically generated',
          completed: true,
        },
      };

      const customOptimisticResponse2 = {
        __typename: 'Mutation',
        createTodo: {
          __typename: 'Todo',
          id: 'optimistic-66',
          text: 'Optimistically generated 2',
          completed: true,
        },
      };

      const updateQueries = {
        todoList: (prev, options) => {
          const mResult = options.mutationResult;

          const state = cloneDeep<any>(prev);

          if (mResult.data) {
            state.todoList.todos.unshift(mResult.data.createTodo);
          }

          return state;
        },
      } as MutationQueryReducersMap<IMutationResult>;

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          dataIdFromObject: (obj: any) => {
            if (obj.id && obj.__typename) {
              return obj.__typename + obj.id;
            }
            return null;
          },
        }),
      });

      // wrap the QueryObservable with an rxjs observable
      const promise = from(
        client.watchQuery({ query }) as any as ObservableInput<any>,
      ).pipe(
        map(value => stripSymbols(value.data.todoList.todos)),
        take(4),
        toArray(),
      ).toPromise();

      // Mutations will not trigger a watchQuery with the results of an optimistic response
      // if set in the same tick of the event loop.
      // https://github.com/apollographql/apollo-client/issues/3723
      await new Promise(resolve => setTimeout(resolve));

      client.mutate({
        mutation,
        optimisticResponse: customOptimisticResponse1,
        updateQueries,
      });

      client.mutate({
        mutation,
        optimisticResponse: customOptimisticResponse2,
        updateQueries,
      });

      const responses = await promise;
      const defaultTodos = stripSymbols(result.data.todoList.todos);

      expect(responses).toEqual([
        defaultTodos,
        [
          customOptimisticResponse2.createTodo,
          customOptimisticResponse1.createTodo,
          ...defaultTodos,
        ],
        [
          customOptimisticResponse2.createTodo,
          mutationResult.data.createTodo,
          ...defaultTodos,
        ],
        [
          mutationResult2.data.createTodo,
          mutationResult.data.createTodo,
          ...defaultTodos,
        ],
      ]);

      resolve();
    });
  });

  describe('optimistic updates using `update`', () => {
    const mutation = gql`
      mutation createTodo {
        # skipping arguments in the test since they don't matter
        createTodo {
          id
          text
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        createTodo: {
          id: '99',
          __typename: 'Todo',
          text: 'This one was created with a mutation.',
          completed: true,
        },
      },
    };

    const optimisticResponse = {
      __typename: 'Mutation',
      createTodo: {
        __typename: 'Todo',
        id: '99',
        text: 'Optimistically generated',
        completed: true,
      },
    };

    const mutationResult2 = {
      data: assign({}, mutationResult.data, {
        createTodo: assign({}, mutationResult.data.createTodo, {
          id: '66',
          text: 'Second mutation.',
        }),
      }),
    };

    const optimisticResponse2 = {
      __typename: 'Mutation',
      createTodo: {
        __typename: 'Todo',
        id: '66',
        text: 'Optimistically generated 2',
        completed: true,
      },
    };

    itAsync('will insert a single itemAsync to the beginning', async (resolve, reject) => {
      expect.assertions(6);
      let subscriptionHandle: Subscription;
      const client = await setup(reject, {
        request: { query: mutation },
        delay: 300,
        result: mutationResult,
      });

      // we have to actually subscribe to the query to be able to update it
      await new Promise(resolve => {
        const handle = client.watchQuery({ query });
        subscriptionHandle = handle.subscribe({
          next(res: any) {
            resolve(res);
          },
        });
      });

      let firstTime = true;
      let before = Date.now();
      const promise = client.mutate({
        mutation,
        optimisticResponse,
        update: (proxy: any, mResult: any) => {
          const after = Date.now();
          const duration = after - before;
          if (firstTime) {
            expect(duration < 300).toBe(true);
            firstTime = false;
          } else {
            expect(duration > 300).toBe(true);
          }
          let data = proxy.readQuery({ query });

          proxy.writeQuery({
            query,
            data: {
              ...data,
              todoList: {
                ...data.todoList,
                todos: [
                  mResult.data.createTodo,
                  ...data.todoList.todos,
                ],
              },
            },
          });
        },
      });

      const dataInStore = (client.cache as InMemoryCache).extract(true);
      expect((dataInStore['TodoList5'] as any).todos.length).toBe(4);
      expect((dataInStore['Todo99'] as any).text).toBe(
        'Optimistically generated',
      );
      await promise;
      await client.query({ query }).then((newResult: any) => {
        subscriptionHandle!.unsubscribe();
        // There should be one more todo item than before
        expect(newResult.data.todoList.todos.length).toBe(4);

        // Since we used `prepend` it should be at the front
        expect(newResult.data.todoList.todos[0].text).toBe(
          'This one was created with a mutation.',
        );
      });

      resolve();
    });

    itAsync('two array insert like mutations', async (resolve, reject) => {
      expect.assertions(9);
      let subscriptionHandle: Subscription;
      const client = await setup(
        reject,
        {
          request: { query: mutation },
          result: mutationResult,
        },
        {
          request: { query: mutation },
          result: mutationResult2,
          delay: 50,
        },
      );

      // we have to actually subscribe to the query to be able to update it
      await new Promise(resolve => {
        const handle = client.watchQuery({ query });
        subscriptionHandle = handle.subscribe({
          next(res: any) {
            resolve(res);
          },
        });
      });

      const update = (proxy: any, mResult: any) => {
        const data: any = proxy.readFragment({
          id: 'TodoList5',
          fragment: gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `,
        });

        proxy.writeFragment({
          data: {
            ...data,
            todos: [mResult.data.createTodo, ...data.todos],
          },
          id: 'TodoList5',
          fragment: gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `,
        });
      };
      const promise = client
        .mutate({
          mutation,
          optimisticResponse,
          update,
        })
        .then((res: any) => {
          const currentDataInStore = (client.cache as InMemoryCache).extract(
            true,
          );
          expect((currentDataInStore['TodoList5'] as any).todos.length).toBe(5);
          expect((currentDataInStore['Todo99'] as any).text).toBe(
            'This one was created with a mutation.',
          );
          expect((currentDataInStore['Todo66'] as any).text).toBe(
            'Optimistically generated 2',
          );
          return res;
        });

      const promise2 = client.mutate({
        mutation,
        optimisticResponse: optimisticResponse2,
        update,
      });

      const dataInStore = (client.cache as InMemoryCache).extract(true);
      expect((dataInStore['TodoList5'] as any).todos.length).toBe(5);
      expect((dataInStore['Todo99'] as any).text).toBe(
        'Optimistically generated',
      );
      expect((dataInStore['Todo66'] as any).text).toBe(
        'Optimistically generated 2',
      );

      await Promise.all([promise, promise2]);

      const newResult: any = await client.query({ query });

      subscriptionHandle!.unsubscribe();
      // There should be one more todo item than before
      expect(newResult.data.todoList.todos.length).toBe(5);

      // Since we used `prepend` it should be at the front
      expect(newResult.data.todoList.todos[0].text).toBe('Second mutation.');
      expect(newResult.data.todoList.todos[1].text).toBe(
        'This one was created with a mutation.',
      );

      resolve();
    });

    itAsync('two mutations, one fails', async (resolve, reject) => {
      expect.assertions(10);
      let subscriptionHandle: Subscription;
      const client = await setup(
        reject,
        {
          request: { query: mutation },
          error: new Error('forbidden (test error)'),
          delay: 20,
        },
        {
          request: { query: mutation },
          result: mutationResult2,
          // XXX this test will uncover a flaw in the design of optimistic responses combined with
          // updateQueries or result reducers if you un-comment the line below. The issue is that
          // optimistic updates are not commutative but are treated as such. When undoing an
          // optimistic update, other optimistic updates should be rolled back and re-applied in the
          // same order as before, otherwise the store can end up in an inconsistent state.
          // delay: 50,
        },
      );

      // we have to actually subscribe to the query to be able to update it
      await new Promise(resolve => {
        const handle = client.watchQuery({ query });
        subscriptionHandle = handle.subscribe({
          next(res: any) {
            resolve(res);
          },
        });
      });

      const update = (proxy: any, mResult: any) => {
        const data: any = proxy.readFragment({
          id: 'TodoList5',
          fragment: gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `,
        });

        proxy.writeFragment({
          data: {
            ...data,
            todos: [mResult.data.createTodo, ...data.todos],
          },
          id: 'TodoList5',
          fragment: gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `,
        });
      };
      const promise = client
        .mutate({
          mutation,
          optimisticResponse,
          update,
        })
        .catch((err: any) => {
          // it is ok to fail here
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('forbidden (test error)');
          return null;
        });

      const promise2 = client.mutate({
        mutation,
        optimisticResponse: optimisticResponse2,
        update,
      });

      const dataInStore = (client.cache as InMemoryCache).extract(true);
      expect((dataInStore['TodoList5'] as any).todos.length).toBe(5);
      expect((dataInStore['Todo99'] as any).text).toBe(
        'Optimistically generated',
      );
      expect((dataInStore['Todo66'] as any).text).toBe(
        'Optimistically generated 2',
      );

      await Promise.all([promise, promise2]);

      subscriptionHandle!.unsubscribe();
      {
        const dataInStore = (client.cache as InMemoryCache).extract(true);
        expect((dataInStore['TodoList5'] as any).todos.length).toBe(4);
        expect(stripSymbols(dataInStore)).not.toHaveProperty('Todo99');
        expect(dataInStore).toHaveProperty('Todo66');
        expect((dataInStore['TodoList5'] as any).todos).toContainEqual(
          makeReference('Todo66'),
        );
        expect((dataInStore['TodoList5'] as any).todos).not.toContainEqual(
          makeReference('Todo99'),
        );
        resolve();
      }
    });

    itAsync('will handle dependent updates', async (resolve, reject) => {
      expect.assertions(1);
      const link = mockSingleLink({
        request: { query },
        result,
      }, {
        request: { query: mutation },
        result: mutationResult,
        delay: 10,
      }, {
        request: { query: mutation },
        result: mutationResult2,
        delay: 20,
      }).setOnError(reject);

      const customOptimisticResponse1 = {
        __typename: 'Mutation',
        createTodo: {
          __typename: 'Todo',
          id: 'optimistic-99',
          text: 'Optimistically generated',
          completed: true,
        },
      };

      const customOptimisticResponse2 = {
        __typename: 'Mutation',
        createTodo: {
          __typename: 'Todo',
          id: 'optimistic-66',
          text: 'Optimistically generated 2',
          completed: true,
        },
      };

      const update = (proxy: any, mResult: any) => {
        const data: any = proxy.readFragment({
          id: 'TodoList5',
          fragment: gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `,
        });

        proxy.writeFragment({
          data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
          id: 'TodoList5',
          fragment: gql`
            fragment todoList on TodoList {
              todos {
                id
                text
                completed
                __typename
              }
            }
          `,
        });
      };

      const client = new ApolloClient({
        link,
        cache: new InMemoryCache({
          dataIdFromObject: (obj: any) => {
            if (obj.id && obj.__typename) {
              return obj.__typename + obj.id;
            }
            return null;
          },
        }),
      });

      const promise = from(
        client.watchQuery({ query }) as any as ObservableInput<any>,
      ).pipe(
        map(value => stripSymbols(value.data.todoList.todos)),
        take(4),
        toArray(),
      ).toPromise();

      await new Promise(resolve => setTimeout(resolve));

      client.mutate({
        mutation,
        optimisticResponse: customOptimisticResponse1,
        update,
      });

      client.mutate({
        mutation,
        optimisticResponse: customOptimisticResponse2,
        update,
      });

      const responses = await promise;
      const defaultTodos = stripSymbols(result.data.todoList.todos);
      expect(responses).toEqual([
        defaultTodos,
        [
          customOptimisticResponse2.createTodo,
          customOptimisticResponse1.createTodo,
          ...defaultTodos,
        ],
        [
          customOptimisticResponse2.createTodo,
          mutationResult.data.createTodo,
          ...defaultTodos,
        ],
        [
          mutationResult2.data.createTodo,
          mutationResult.data.createTodo,
          ...defaultTodos,
        ],
      ]);

      resolve();
    });
  });
});

describe('optimistic mutation - githunt comments', () => {
  const query = gql`
    query Comment($repoName: String!) {
      entry(repoFullName: $repoName) {
        comments {
          postedBy {
            login
            html_url
          }
        }
      }
    }
  `;
  const queryWithFragment = gql`
    query Comment($repoName: String!) {
      entry(repoFullName: $repoName) {
        comments {
          ...authorFields
        }
      }
    }

    fragment authorFields on User {
      postedBy {
        login
        html_url
      }
    }
  `;
  const variables = {
    repoName: 'org/repo',
  };
  const userDoc = {
    __typename: 'User',
    login: 'stubailo',
    html_url: 'http://avatar.com/stubailo.png',
  };

  const result = {
    data: {
      __typename: 'Query',
      entry: {
        __typename: 'Entry',
        comments: [
          {
            __typename: 'Comment',
            postedBy: userDoc,
          },
        ],
      },
    },
  };

  async function setup(
    reject: (reason: any) => any,
    ...mockedResponses: any[]
  ) {
    const link = mockSingleLink({
      request: {
        query: addTypenameToDocument(query),
        variables,
      },
      result,
    }, {
      request: {
        query: addTypenameToDocument(queryWithFragment),
        variables,
      },
      result,
    }, ...mockedResponses).setOnError(reject);

    const client = new ApolloClient({
      link,
      cache: new InMemoryCache({
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
      }),
    });

    const obsHandle = client.watchQuery({
      query,
      variables,
    });

    await obsHandle.result();

    return client;
  }

  const mutation = gql`
    mutation submitComment($repoFullName: String!, $commentContent: String!) {
      submitComment(
        repoFullName: $repoFullName
        commentContent: $commentContent
      ) {
        postedBy {
          login
          html_url
        }
      }
    }
  `;

  type IMutationResult = {
    __typename: string;
    submitComment: {
      __typename: string;
      postedBy: {
        __typename: string;
        login: string;
        html_url: string;
      };
    };
  };
  const mutationResult = {
    data: {
      __typename: 'Mutation',
      submitComment: {
        __typename: 'Comment',
        postedBy: userDoc,
      },
    },
  };
  const updateQueries = {
    Comment: (prev, { mutationResult: mutationResultArg }) => {
      if (mutationResultArg.data) {
        const newComment = mutationResultArg.data.submitComment;
        const state = cloneDeep<any>(prev);
        state.entry.comments.unshift(newComment);
        return state;
      }

      return prev;
    },
  } as MutationQueryReducersMap<IMutationResult>;
  const optimisticResponse = {
    __typename: 'Mutation',
    submitComment: {
      __typename: 'Comment',
      postedBy: userDoc,
    },
  };

  itAsync('can post a new comment', async (resolve, reject) => {
    expect.assertions(1);
    const mutationVariables = {
      repoFullName: 'org/repo',
      commentContent: 'New Comment',
    };

    let subscriptionHandle: Subscription;
    const client = await setup(reject, {
      request: {
        query: addTypenameToDocument(mutation),
        variables: mutationVariables,
      },
      result: mutationResult,
    });

    // we have to actually subscribe to the query to be able to update it
    await new Promise(resolve => {
      const handle = client.watchQuery({ query, variables });
      subscriptionHandle = handle.subscribe({
        next(res: any) {
          resolve(res);
        },
      });
    });

    await client.mutate({
      mutation,
      optimisticResponse,
      variables: mutationVariables,
      updateQueries,
    });

    const newResult: any = await client.query({ query, variables });

    subscriptionHandle!.unsubscribe();
    expect(newResult.data.entry.comments.length).toBe(2);

    resolve();
  });
});
