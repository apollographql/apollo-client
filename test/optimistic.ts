import * as chai from 'chai';
const { assert } = chai;

import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient from '../src';
import { MutationQueryReducersMap } from '../src/data/mutationResults';
import { NormalizedCache, StoreObject } from '../src/data/storeUtils';

import { assign, cloneDeep} from 'lodash';

import { Subscription } from '../src/util/Observable';

import gql from 'graphql-tag';

import {
  addTypenameToDocument,
} from '../src/queries/queryTransform';

import {
  isMutationResultAction,
} from '../src/actions';

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

  let client: ApolloClient;
  let networkInterface: any;

  type CustomMutationBehavior = {
    type: 'CUSTOM_MUTATION_RESULT',
    dataId: string,
    field: string,
    value: any,
  };

  function setup(...mockedResponses: any[]) {
    networkInterface = mockNetworkInterface({
      request: { query },
      result,
    }, ...mockedResponses);

    client = new ApolloClient({
      networkInterface,
      dataIdFromObject: (obj: any) => {
        if (obj.id && obj.__typename) {
          return obj.__typename + obj.id;
        }
        return null;
      },
    });

    const obsHandle = client.watchQuery({
      query,
    });

    return obsHandle.result();
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

      it('handles a single error for a single mutation', () => {
        return setup({
          request: { query: mutation },
          error: new Error('forbidden (test error)'),
        })
        .then(() => {
          const promise = client.mutate({
            mutation,
            optimisticResponse,
            updateQueries,
          });

          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
          assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');

          return promise;
        })
        .catch((err) => {
          assert.instanceOf(err, Error);
          assert.equal(err.message, 'Network error: forbidden (test error)');

          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 3);
          assert.notProperty(dataInStore, 'Todo99');
        });
      });

      it('handles errors produced by one mutation in a series', () => {
        let subscriptionHandle: Subscription;
        return setup({
          request: { query: mutation },
          error: new Error('forbidden (test error)'),
        }, {
          request: { query: mutation },
          result: mutationResult2,
        })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise( (resolve, reject) => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) { resolve(res); },
            });
          });
        })
        .then(() => {
          const promise = client.mutate({
            mutation,
            optimisticResponse,
            updateQueries,
          }).catch((err) => {
            // it is ok to fail here
            assert.instanceOf(err, Error);
            assert.equal(err.message, 'Network error: forbidden (test error)');
            return null;
          });

          const promise2 = client.mutate({
            mutation,
            optimisticResponse: optimisticResponse2,
            updateQueries,
          });

          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
          assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');
          assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');

          return Promise.all([promise, promise2]);
        })
        .then(() => {
          subscriptionHandle.unsubscribe();
          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
          assert.notProperty(dataInStore, 'Todo99');
          assert.property(dataInStore, 'Todo66');
          assert.include((dataInStore['TodoList5'] as any).todos, realIdValue('Todo66'));
          assert.notInclude((dataInStore['TodoList5'] as any).todos, realIdValue('Todo99'));
        });
      });

      it('can run 2 mutations concurrently and handles all intermediate states well', () => {
        function checkBothMutationsAreApplied(expectedText1: any, expectedText2: any) {
          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
          assert.property(dataInStore, 'Todo99');
          assert.property(dataInStore, 'Todo66');
          assert.include((dataInStore['TodoList5'] as any).todos, realIdValue('Todo66'));
          assert.include((dataInStore['TodoList5'] as any).todos, realIdValue('Todo99'));
          assert.equal((dataInStore['Todo99'] as any).text, expectedText1);
          assert.equal((dataInStore['Todo66'] as any).text, expectedText2);
        }
        let subscriptionHandle: Subscription;
        return setup({
          request: { query: mutation },
          result: mutationResult,
        }, {
          request: { query: mutation },
          result: mutationResult2,
          // make sure it always happens later
          delay: 100,
        })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise( (resolve, reject) => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) { resolve(res); },
            });
          });
        })
        .then(() => {
          const promise = client.mutate({
            mutation,
            optimisticResponse,
            updateQueries,
          }).then((res) => {
            checkBothMutationsAreApplied('This one was created with a mutation.', 'Optimistically generated 2');
            const mutationsState = client.store.getState().apollo.mutations;
            assert.equal(mutationsState['5'].loading, false);
            assert.equal(mutationsState['6'].loading, true);

            return res;
          });

          const promise2 = client.mutate({
            mutation,
            optimisticResponse: optimisticResponse2,
            updateQueries,
          }).then((res) => {
            checkBothMutationsAreApplied('This one was created with a mutation.', 'Second mutation.');
            const mutationsState = client.store.getState().apollo.mutations;
            assert.equal(mutationsState[5].loading, false);
            assert.equal(mutationsState[6].loading, false);

            return res;
          });

          const mutationsState = client.store.getState().apollo.mutations;
          assert.equal(mutationsState[5].loading, true);
          assert.equal(mutationsState[6].loading, true);

          checkBothMutationsAreApplied('Optimistically generated', 'Optimistically generated 2');

          return Promise.all([promise, promise2]);
        })
        .then(() => {
          subscriptionHandle.unsubscribe();
          checkBothMutationsAreApplied('This one was created with a mutation.', 'Second mutation.');
        });
      });
    });

    describe('with `update`', () => {
      const update = (proxy: any, mResult: any) => {
        const data: any = proxy.readFragment({
          id: 'TodoList5',
          fragment: gql`fragment todoList on TodoList { todos { id text completed __typename } }`,
        });

        proxy.writeFragment({
          data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
          id: 'TodoList5',
          fragment: gql`fragment todoList on TodoList { todos { id text completed __typename } }`,
        });
      };

      it('handles a single error for a single mutation', () => {
        return setup({
          request: { query: mutation },
          error: new Error('forbidden (test error)'),
        })
        .then(() => {
          const promise = client.mutate({
            mutation,
            optimisticResponse,
            update,
          });

          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
          assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');

          return promise;
        })
        .catch((err) => {
          assert.instanceOf(err, Error);
          assert.equal(err.message, 'Network error: forbidden (test error)');

          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 3);
          assert.notProperty(dataInStore, 'Todo99');
        });
      });

      it('handles errors produced by one mutation in a series', () => {
        let subscriptionHandle: Subscription;
        return setup({
          request: { query: mutation },
          error: new Error('forbidden (test error)'),
        }, {
          request: { query: mutation },
          result: mutationResult2,
        })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise( (resolve, reject) => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) { resolve(res); },
            });
          });
        })
        .then(() => {
          const promise = client.mutate({
            mutation,
            optimisticResponse,
            update,
          }).catch((err) => {
            // it is ok to fail here
            assert.instanceOf(err, Error);
            assert.equal(err.message, 'Network error: forbidden (test error)');
            return null;
          });

          const promise2 = client.mutate({
            mutation,
            optimisticResponse: optimisticResponse2,
            update,
          });

          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
          assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');
          assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');

          return Promise.all([promise, promise2]);
        })
        .then(() => {
          subscriptionHandle.unsubscribe();
          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
          assert.notProperty(dataInStore, 'Todo99');
          assert.property(dataInStore, 'Todo66');
          assert.include((dataInStore['TodoList5'] as any).todos, realIdValue('Todo66'));
          assert.notInclude((dataInStore['TodoList5'] as any).todos, realIdValue('Todo99'));
        });
      });

      it('can run 2 mutations concurrently and handles all intermediate states well', () => {
        function checkBothMutationsAreApplied(expectedText1: any, expectedText2: any) {
          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
          assert.property(dataInStore, 'Todo99');
          assert.property(dataInStore, 'Todo66');
          assert.include((dataInStore['TodoList5'] as any).todos, realIdValue('Todo66'));
          assert.include((dataInStore['TodoList5'] as any).todos, realIdValue('Todo99'));
          assert.equal((dataInStore['Todo99'] as any).text, expectedText1);
          assert.equal((dataInStore['Todo66'] as any).text, expectedText2);
        }
        let subscriptionHandle: Subscription;
        return setup({
          request: { query: mutation },
          result: mutationResult,
        }, {
          request: { query: mutation },
          result: mutationResult2,
          // make sure it always happens later
          delay: 100,
        })
        .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise( (resolve, reject) => {
            const handle = client.watchQuery({ query });
            subscriptionHandle = handle.subscribe({
              next(res) { resolve(res); },
            });
          });
        })
        .then(() => {
          const promise = client.mutate({
            mutation,
            optimisticResponse,
            update,
          }).then((res) => {
            checkBothMutationsAreApplied('This one was created with a mutation.', 'Optimistically generated 2');
            const mutationsState = client.store.getState().apollo.mutations;
            assert.equal(mutationsState['5'].loading, false);
            assert.equal(mutationsState['6'].loading, true);

            return res;
          });

          const promise2 = client.mutate({
            mutation,
            optimisticResponse: optimisticResponse2,
            update,
          }).then((res) => {
            checkBothMutationsAreApplied('This one was created with a mutation.', 'Second mutation.');
            const mutationsState = client.store.getState().apollo.mutations;
            assert.equal(mutationsState[5].loading, false);
            assert.equal(mutationsState[6].loading, false);

            return res;
          });

          const mutationsState = client.store.getState().apollo.mutations;
          assert.equal(mutationsState[5].loading, true);
          assert.equal(mutationsState[6].loading, true);

          checkBothMutationsAreApplied('Optimistically generated', 'Optimistically generated 2');

          return Promise.all([promise, promise2]);
        })
        .then(() => {
          subscriptionHandle.unsubscribe();
          checkBothMutationsAreApplied('This one was created with a mutation.', 'Second mutation.');
        });
      });
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

    it('will insert a single item to the beginning', () => {
      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise( (resolve, reject) => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res) { resolve(res); },
          });
        });
      })
      .then(() => {
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          updateQueries: {
            todoList: (prev, options) => {
              const mResult = options.mutationResult as any;
              assert.equal(mResult.data.createTodo.id, '99');

              const state = cloneDeep(prev) as any;
              state.todoList.todos.unshift(mResult.data.createTodo);
              return state;
            },
          },
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');

        return promise;
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        subscriptionHandle.unsubscribe();
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('two array insert like mutations', () => {
      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      }, {
        request: { query: mutation },
        result: mutationResult2,
        delay: 50,
      })
      .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise( (resolve, reject) => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res) { resolve(res); },
          });
        });
      })
      .then(() => {
        const updateQueries = {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;

            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        } as MutationQueryReducersMap;
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          updateQueries,
        }).then((res) => {
          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
          assert.equal((dataInStore['Todo99'] as any).text, 'This one was created with a mutation.');
          assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');
          return res;
        });

        const promise2 = client.mutate({
          mutation,
          optimisticResponse: optimisticResponse2,
          updateQueries,
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');
        assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');

        return Promise.all([promise, promise2]);
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        subscriptionHandle.unsubscribe();
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 5);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'Second mutation.');
        assert.equal(newResult.data.todoList.todos[1].text, 'This one was created with a mutation.');
      });
    });

    it('two mutations, one fails', () => {
      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        error: new Error('forbidden (test error)'),
        delay: 20,
      }, {
        request: { query: mutation },
        result: mutationResult2,
        // XXX this test will uncover a flaw in the design of optimistic responses combined with
        // updateQueries or result reducers if you un-comment the line below. The issue is that
        // optimistic updates are not commutative but are treated as such. When undoing an
        // optimistic update, other optimistic updates should be rolled back and re-applied in the
        // same order as before, otherwise the store can end up in an inconsistent state.
        // delay: 50,
      })
      .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise( (resolve, reject) => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res) { resolve(res); },
          });
        });
      })
      .then(() => {
        const updateQueries = {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;

            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        } as MutationQueryReducersMap;
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          updateQueries,
        }).catch((err) => {
          // it is ok to fail here
          assert.instanceOf(err, Error);
          assert.equal(err.message, 'Network error: forbidden (test error)');
          return null;
        });

        const promise2 = client.mutate({
          mutation,
          optimisticResponse: optimisticResponse2,
          updateQueries,
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');
        assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');

        return Promise.all([promise, promise2]);
      })
      .then(() => {
        subscriptionHandle.unsubscribe();
        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
        assert.notProperty(dataInStore, 'Todo99');
        assert.property(dataInStore, 'Todo66');
        assert.include((dataInStore['TodoList5'] as any).todos, realIdValue('Todo66'));
        assert.notInclude((dataInStore['TodoList5'] as any).todos, realIdValue('Todo99'));
      });
    });

    it('will handle dependent updates', done => {
      networkInterface = mockNetworkInterface({
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
      });

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
          const mResult = options.mutationResult as any;

          const state = cloneDeep(prev) as any;
          state.todoList.todos.unshift(mResult.data.createTodo);
          return state;
        },
      } as MutationQueryReducersMap;

      client = new ApolloClient({
        networkInterface,
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
      });

      const defaultTodos = result.data.todoList.todos;
      let count = 0;

      client.watchQuery({ query }).subscribe({
        next: (value: any) => {
          const todos = value.data.todoList.todos;
          switch (count++) {
            case 0:
              assert.deepEqual(defaultTodos, todos);
              twoMutations();
              break;
            case 1:
              assert.deepEqual([customOptimisticResponse1.createTodo, ...defaultTodos], todos);
              break;
            case 2:
              assert.deepEqual([customOptimisticResponse2.createTodo, customOptimisticResponse1.createTodo, ...defaultTodos], todos);
              break;
            case 3:
              assert.deepEqual([customOptimisticResponse2.createTodo, mutationResult.data.createTodo, ...defaultTodos], todos);
              break;
            case 4:
              assert.deepEqual([mutationResult2.data.createTodo, mutationResult.data.createTodo, ...defaultTodos], todos);
              done();
              break;
            default:
              done(new Error('Next should not have been called again.'));
          }
        },
        error: error => done(error),
      });

      function twoMutations () {
        client.mutate({
          mutation,
          optimisticResponse: customOptimisticResponse1,
          updateQueries,
        })
          .catch(error => done(error));

        client.mutate({
          mutation,
          optimisticResponse: customOptimisticResponse2,
          updateQueries,
        })
          .catch(error => done(error));
      }
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

    it('will insert a single item to the beginning', () => {
      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise( (resolve, reject) => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res) { resolve(res); },
          });
        });
      })
      .then(() => {
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          update: (proxy, mResult: any) => {
            assert.equal(mResult.data.createTodo.id, '99');

            const id = 'TodoList5';
            const fragment = gql`fragment todoList on TodoList { todos { id text completed __typename } }`;

            const data: any = proxy.readFragment({ id, fragment });

            proxy.writeFragment({
              data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
              id, fragment,
            });
          },
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');

        return promise;
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        subscriptionHandle.unsubscribe();
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('two array insert like mutations', () => {
      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      }, {
        request: { query: mutation },
        result: mutationResult2,
        delay: 50,
      })
      .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise( (resolve, reject) => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res) { resolve(res); },
          });
        });
      })
      .then(() => {
        const update = (proxy: any, mResult: any) => {
          const data: any = proxy.readFragment({
            id: 'TodoList5',
            fragment: gql`fragment todoList on TodoList { todos { id text completed __typename } }`,
          });

          proxy.writeFragment({
            data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
            id: 'TodoList5',
            fragment: gql`fragment todoList on TodoList { todos { id text completed __typename } }`,
          });
        };
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          update,
        }).then((res) => {
          const dataInStore = client.queryManager.getDataWithOptimisticResults();
          assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
          assert.equal((dataInStore['Todo99'] as any).text, 'This one was created with a mutation.');
          assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');
          return res;
        });

        const promise2 = client.mutate({
          mutation,
          optimisticResponse: optimisticResponse2,
          update,
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');
        assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');

        return Promise.all([promise, promise2]);
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        subscriptionHandle.unsubscribe();
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 5);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'Second mutation.');
        assert.equal(newResult.data.todoList.todos[1].text, 'This one was created with a mutation.');
      });
    });

    it('two mutations, one fails', () => {
      let subscriptionHandle: Subscription;
      return setup({
        request: { query: mutation },
        error: new Error('forbidden (test error)'),
        delay: 20,
      }, {
        request: { query: mutation },
        result: mutationResult2,
        // XXX this test will uncover a flaw in the design of optimistic responses combined with
        // updateQueries or result reducers if you un-comment the line below. The issue is that
        // optimistic updates are not commutative but are treated as such. When undoing an
        // optimistic update, other optimistic updates should be rolled back and re-applied in the
        // same order as before, otherwise the store can end up in an inconsistent state.
        // delay: 50,
      })
      .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise( (resolve, reject) => {
          const handle = client.watchQuery({ query });
          subscriptionHandle = handle.subscribe({
            next(res) { resolve(res); },
          });
        });
      })
      .then(() => {
        const update = (proxy: any, mResult: any) => {
          const data: any = proxy.readFragment({
            id: 'TodoList5',
            fragment: gql`fragment todoList on TodoList { todos { id text completed __typename } }`,
          });

          proxy.writeFragment({
            data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
            id: 'TodoList5',
            fragment: gql`fragment todoList on TodoList { todos { id text completed __typename } }`,
          });
        };
        const promise = client.mutate({
          mutation,
          optimisticResponse,
          update,
        }).catch((err) => {
          // it is ok to fail here
          assert.instanceOf(err, Error);
          assert.equal(err.message, 'Network error: forbidden (test error)');
          return null;
        });

        const promise2 = client.mutate({
          mutation,
          optimisticResponse: optimisticResponse2,
          update,
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 5);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');
        assert.equal((dataInStore['Todo66'] as any).text, 'Optimistically generated 2');

        return Promise.all([promise, promise2]);
      })
      .then(() => {
        subscriptionHandle.unsubscribe();
        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
        assert.notProperty(dataInStore, 'Todo99');
        assert.property(dataInStore, 'Todo66');
        assert.include((dataInStore['TodoList5'] as any).todos, realIdValue('Todo66'));
        assert.notInclude((dataInStore['TodoList5'] as any).todos, realIdValue('Todo99'));
      });
    });

    it('will handle dependent updates', done => {
      networkInterface = mockNetworkInterface({
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
      });

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
          fragment: gql`fragment todoList on TodoList { todos { id text completed __typename } }`,
        });

        proxy.writeFragment({
          data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
          id: 'TodoList5',
          fragment: gql`fragment todoList on TodoList { todos { id text completed __typename } }`,
        });
      };

      client = new ApolloClient({
        networkInterface,
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
      });

      const defaultTodos = result.data.todoList.todos;
      let count = 0;

      client.watchQuery({ query }).subscribe({
        next: (value: any) => {
          const todos = value.data.todoList.todos;
          switch (count++) {
            case 0:
              assert.deepEqual(defaultTodos, todos);
              twoMutations();
              break;
            case 1:
              assert.deepEqual([customOptimisticResponse1.createTodo, ...defaultTodos], todos);
              break;
            case 2:
              assert.deepEqual([customOptimisticResponse2.createTodo, customOptimisticResponse1.createTodo, ...defaultTodos], todos);
              break;
            case 3:
              assert.deepEqual([customOptimisticResponse2.createTodo, mutationResult.data.createTodo, ...defaultTodos], todos);
              break;
            case 4:
              assert.deepEqual([mutationResult2.data.createTodo, mutationResult.data.createTodo, ...defaultTodos], todos);
              done();
              break;
            default:
              done(new Error('Next should not have been called again.'));
          }
        },
        error: error => done(error),
      });

      function twoMutations () {
        client.mutate({
          mutation,
          optimisticResponse: customOptimisticResponse1,
          update,
        })
          .catch(error => done(error));

        client.mutate({
          mutation,
          optimisticResponse: customOptimisticResponse2,
          update,
        })
          .catch(error => done(error));
      }
    });
  });

  describe('optimistic updates with result reducer', () => {
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

    /*
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
    */

    /*
    .then(() => {
        observableQuery = client.watchQuery({
          query,
          reducer: (previousResult, action) => {
            counter++;
            if (isMutationResultAction(action)) {
              const newResult = cloneDeep(previousResult) as any;
              newResult.todoList.todos.unshift(action.result.data.createTodo);
              return newResult;
            }
            return previousResult;
          },
        }).subscribe({
          next: () => null, // TODO: we should actually check the new result
        });
        return client.mutate({
          mutation,
        });
      })
    */

    it('can add an item to an array', () => {
      let observableQuery: any;
      let counter = 0;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        observableQuery = client.watchQuery({
          query,
          reducer: (previousResult, action) => {
            counter++;
            if (isMutationResultAction(action)) {
              const newResult = cloneDeep(previousResult) as any;
              newResult.todoList.todos.unshift(action.result.data!['createTodo']);
              return newResult;
            }
            return previousResult;
          },
        }).subscribe({
          next: () => null, // TODO: we should actually check the new result
        });
      })
      .then(() => {
        const promise = client.mutate({
          mutation,
          optimisticResponse,
        });

        const dataInStore = client.queryManager.getDataWithOptimisticResults();
        assert.equal((dataInStore['TodoList5'] as any).todos.length, 4);
        assert.equal((dataInStore['Todo99'] as any).text, 'Optimistically generated');

        return promise;
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('will handle dependent updates', done => {
      const customMutationResult1 = {
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

      const customMutationResult2 = {
        data: {
          __typename: 'Mutation',
          createTodo: {
            id: '66',
            __typename: 'Todo',
            text: 'Second mutation.',
            completed: true,
          },
        },
      };

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

      networkInterface = mockNetworkInterface({
        request: { query },
        result,
      }, {
        request: { query: mutation },
        result: customMutationResult1,
        delay: 10,
      }, {
        request: { query: mutation },
        result: customMutationResult2,
        delay: 20,
      });

      client = new ApolloClient({
        networkInterface,
        dataIdFromObject: (obj: any) => {
          if (obj.id && obj.__typename) {
            return obj.__typename + obj.id;
          }
          return null;
        },
      });

      const defaultTodos = result.data.todoList.todos;
      let count = 0;

      client.watchQuery({
        query,
        reducer: (previousResult, action) => {
          if (isMutationResultAction(action)) {
            const newResult = cloneDeep(previousResult) as any;
            newResult.todoList.todos.unshift(action.result.data!['createTodo']);
            return newResult;
          }
          return previousResult;
        },
      }).subscribe({
        next: (value: any) => {
          const todos = value.data.todoList.todos;
          switch (count++) {
            case 0:
              assert.deepEqual(defaultTodos, todos);
              twoMutations();
              break;
            case 1:
              assert.deepEqual([customOptimisticResponse1.createTodo, ...defaultTodos], todos);
              break;
            case 2:
              assert.deepEqual([customOptimisticResponse2.createTodo, customOptimisticResponse1.createTodo, ...defaultTodos], todos);
              break;
            case 3:
              assert.deepEqual([customOptimisticResponse2.createTodo, customMutationResult1.data.createTodo, ...defaultTodos], todos);
              break;
            case 4:
              assert.deepEqual([customMutationResult2.data.createTodo, customMutationResult1.data.createTodo, ...defaultTodos], todos);
              done();
              break;
            default:
              done(new Error('Next should not have been called again.'));
          }
        },
        error: error => done(error),
      });

      function twoMutations () {
        client.mutate({
          mutation,
          optimisticResponse: customOptimisticResponse1,
        })
          .catch(error => done(error));

        client.mutate({
          mutation,
          optimisticResponse: customOptimisticResponse2,
        })
          .catch(error => done(error));
      }
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

  let client: ApolloClient;
  let networkInterface: any;

  function setup(...mockedResponses: any[]) {
    networkInterface = mockNetworkInterface({
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
    }, ...mockedResponses);

    client = new ApolloClient({
      networkInterface,
      dataIdFromObject: (obj: any) => {
        if (obj.id && obj.__typename) {
          return obj.__typename + obj.id;
        }
        return null;
      },
    });

    const obsHandle = client.watchQuery({
      query,
      variables,
    });

    return obsHandle.result();
  }

  const mutation = gql`
    mutation submitComment($repoFullName: String!, $commentContent: String!) {
      submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
        postedBy {
          login
          html_url
        }
      }
    }
  `;

  const mutationWithFragment = gql`
    mutation submitComment($repoFullName: String!, $commentContent: String!) {
      submitComment(repoFullName: $repoFullName, commentContent: $commentContent) {
        ...authorFields
      }
    }
  `;

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
      const newComment = (mutationResultArg as any).data.submitComment;
      const state = cloneDeep(prev);
      (state as any).entry.comments.unshift(newComment);
      return state;
    },
  } as MutationQueryReducersMap;
  const optimisticResponse = {
    __typename: 'Mutation',
    submitComment: {
      __typename: 'Comment',
      postedBy: userDoc,
    },
  };

  it('can post a new comment', () => {
    const mutationVariables = {
      repoFullName: 'org/repo',
      commentContent: 'New Comment',
    };

    let subscriptionHandle: Subscription;
    return setup({
      request: {
        query: addTypenameToDocument(mutation),
        variables: mutationVariables,
      },
      result: mutationResult,
    })
    .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise( (resolve, reject) => {
          const handle = client.watchQuery({ query, variables });
          subscriptionHandle = handle.subscribe({
            next(res) { resolve(res); },
          });
        });
      })
    .then(() => {
      return client.mutate({
        mutation,
        optimisticResponse,
        variables: mutationVariables,
        updateQueries,
      });
    }).then(() => {
      return client.query({ query, variables });
    }).then((newResult: any) => {
      subscriptionHandle.unsubscribe();
      assert.equal(newResult.data.entry.comments.length, 2);
    });
  });
});

function realIdValue(id: string) {
  return {
    type: 'id',
    generated: false,
    id,
  };
}
