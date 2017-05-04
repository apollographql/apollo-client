import { assert } from 'chai';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient from '../src';
import { NormalizedCache, StoreObject } from '../src/data/storeUtils';
import { isMutationResultAction, isQueryResultAction } from '../src/actions';

import { Subscription } from '../src/util/Observable';

import { assign, cloneDeep } from 'lodash';

import { ObservableQuery } from '../src/core/ObservableQuery';

import gql from 'graphql-tag';

import { withWarning } from './util/wrap';

describe('mutation results', () => {

  const query = gql`
    query todoList {
      todoList(id: 5) {
        id
        todos {
          id
          text
          completed
        }
        filteredTodos: todos(completed: true) {
          id
          text
          completed
        }
      }
      noIdList: todoList(id: 6) {
        id
        todos {
          text
          completed
        }
      }
    }
  `;

  const queryWithTypename = gql`
    query todoList {
      todoList(id: 5) {
        id
        todos {
          id
          text
          completed
          __typename
        }
        filteredTodos: todos(completed: true) {
          id
          text
          completed
          __typename
        }
        __typename
      }
      noIdList: todoList(id: 6) {
        id
        todos {
          text
          completed
          __typename
        }
        __typename
      }
    }
  `;

  const queryWithVars = gql`
    query todoList ($id: Int){
      __typename
      todoList(id: $id) {
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

  const result6: any = {
    data: {
      __typename: 'Query',
      todoList: {
        __typename: 'TodoList',
        id: '6',
        todos: [
          {
            __typename: 'Todo',
            id: '13',
            text: 'Hello world',
            completed: false,
          },
          {
            __typename: 'Todo',
            id: '16',
            text: 'Second task',
            completed: false,
          },
          {
            __typename: 'Todo',
            id: '112',
            text: 'Do other stuff',
            completed: false,
          },
        ],
        filteredTodos: [],
      },
    },
  };

  const result5: any = {
    data: {
      __typename: 'Query',
      todoList: {
        __typename: 'TodoList',
        id: '5',
        todos: [
          {
            __typename: 'Todo',
            id: '13',
            text: 'Hello world',
            completed: false,
          },
          {
            __typename: 'Todo',
            id: '16',
            text: 'Second task',
            completed: false,
          },
          {
            __typename: 'Todo',
            id: '112',
            text: 'Do other stuff',
            completed: false,
          },
        ],
        filteredTodos: [],
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

  function setupObsHandle(...mockedResponses: any[]) {
    networkInterface = mockNetworkInterface({
      request: { query: queryWithTypename },
      result,
    }, ...mockedResponses);

    client = new ApolloClient({
      networkInterface,
      addTypename: true,
      dataIdFromObject: (obj: any) => {
        if (obj.id && obj.__typename) {
          return obj.__typename + obj.id;
        }
        return null;
      },
    });

    return client.watchQuery({
      query,
      notifyOnNetworkStatusChange: false,
    });
  }

  function setupDelayObsHandle(delay: number, ...mockedResponses: any[]) {
    networkInterface = mockNetworkInterface({
      request: { query: queryWithTypename },
      result,
      delay,
    }, ...mockedResponses);

    client = new ApolloClient({
      networkInterface,
      addTypename: true,
      dataIdFromObject: (obj: any) => {
        if (obj.id && obj.__typename) {
          return obj.__typename + obj.id;
        }
        return null;
      },
    });

    return client.watchQuery({
      query,
      notifyOnNetworkStatusChange: false,
    });
  }

  function setup(...mockedResponses: any[]) {
    const obsHandle = setupObsHandle(...mockedResponses);
    return obsHandle.result();
  }

  it('correctly primes cache for tests', () => {
    return setup()
      .then(() => client.query({
        query,
      }));
  });

  it('correctly integrates field changes by default', () => {
    const mutation = gql`
      mutation setCompleted {
        setCompleted(todoId: "3") {
          id
          completed
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        setCompleted: {
          __typename: 'Todo',
          id: '3',
          completed: true,
        },
      },
    };

    return setup({
      request: { query: mutation },
      result: mutationResult,
    })
    .then(() => {
      return client.mutate({ mutation });
    })
    .then(() => {
      return client.query({ query });
    })
    .then((newResult: any) => {
      assert.isTrue(newResult.data.todoList.todos[0].completed);
    });
  });

  it('should warn when the result fields don\'t match the query fields', () => {
    let handle: any;
    let subscriptionHandle: Subscription;
    let counter = 0;

    const queryTodos = gql`
      query todos {
        todos {
          id
          name
          description
          __typename
        }
      }
    `;

    const queryTodosResult = {
      data: {
        todos: [{
          id: '1',
          name: 'Todo 1',
          description: 'Description 1',
          __typename: 'todos',
        }],
      },
    };

    const mutationTodo = gql`
      mutation createTodo {
        createTodo {
          id
          name
          # missing field: description
          __typename
        }
      }
    `;

    const mutationTodoResult = {
      data: {
        createTodo: {
          id: '2',
          name: 'Todo 2',
          __typename: 'createTodo',
        },
      },
    };

    return withWarning(() => {
      return setup({
        request: { query: queryTodos },
        result: queryTodosResult,
      }, {
        request: { query: mutationTodo },
        result: mutationTodoResult,
      })
      .then(() => {
          // we have to actually subscribe to the query to be able to update it
          return new Promise( (resolve, reject) => {
            handle = client.watchQuery({ query: queryTodos });
            subscriptionHandle = handle.subscribe({
              next(res: any) {
                counter++;
                resolve(res);
              },
            });
          });
        })
        .then(() => {
          return client.mutate({
            mutation: mutationTodo,
            updateQueries: {
              todos: (prev, { mutationResult }) => {
                const newTodo = (mutationResult as any).data.createTodo;

                const newResults = {
                  todos: [
                    ...(prev as any).todos,
                    newTodo,
                  ],
                };
                return newResults;
              },
            },
          });
        }).then(() => subscriptionHandle.unsubscribe());
    }, /Missing field description/);
  });

  describe('result reducer', () => {
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

    const query2 = gql`
      query newTodos {
        __typename
        newTodos(since: 1){
          __typename
          id
          text
          completed
        }
      }
    `;

    const result2: any = {
      data: {
        __typename: 'Query',
        newTodos: [
          {
              __typename: 'Todo',
            id: '3030',
            text: 'Recently added',
            completed: false,
          },
        ],
      },
    };

    it('is called on mutation result', () => {
      let counter = 0;
      let observableQuery: any;
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
        return client.mutate({
          mutation,
        });
      })
      .then(() => {
        // TODO: improve this test. Now it just works because this query is the same as the watchQuery with the reducer.
        return client.query({ query });
      })
      .then((newResult: any) => {
        observableQuery.unsubscribe();

        // The reducer should have been called once
        assert.equal(counter, 1);

        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('passes variables', () => {
      let counter = 0;
      let observableQuery: ObservableQuery<any>;
      let subscription: any;

      return setup({
        request: { query: queryWithVars, variables: { id: 5 } },
        result: result5,
      }, {
        request: { query: mutation},
        result: mutationResult,
        delay: 5,
      }, {
        request: { query: queryWithVars, variables: { id: 6 } },
        result: result6,
      }, {
        request: { query: mutation},
        result: mutationResult,
      })
      .then(() => {
        observableQuery = client.watchQuery({
          query: queryWithVars,
          variables: { id: 5 },
          reducer: (previousResult, action, variables: any) => {
            counter++;
            if (isMutationResultAction(action) && variables['id'] === 5) {
              const newResult = cloneDeep(previousResult) as any;
              newResult.todoList.todos.unshift(action.result.data!['createTodo']);
              return newResult;
            }
            return previousResult;
          },
        });

        subscription = observableQuery.subscribe({
          next: () => null, // TODO: we should actually check the new result
        });
        return client.mutate({
          mutation,
        });
      })
      .then(() => {
        return observableQuery.setOptions({ variables: { id: 6 } });
      })
      .then((res) => {
        return client.mutate({
          mutation,
        });
      })
      .then(() => {
        // going back to check the result of the original query
        return observableQuery.setOptions({ variables: { id: 5 } });
      })
      .then((newResult: any) => {
        subscription.unsubscribe();

        // The reducer should have been called twice
        assert.equal(counter, 4);

        // But there should be one more todo item than before, because variables only matched once
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('can filter based on operationName', () => {
      let counter = 0;
      let observableQuery: any;
      let observableQuery2: any;
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        observableQuery = client.watchQuery({
          query,
          reducer: (previousResult, action) => {
            if (isMutationResultAction(action) && action.operationName === 'createTodo') {
              counter++;
              const newResult = cloneDeep(previousResult) as any;
              newResult.todoList.todos.unshift(action.result.data!['createTodo']);
              return newResult;
            }
            return previousResult;
          },
        }).subscribe({
          next: () => null, // TODO: we should actually check the new result
        });

        // this query subscribes to the same data, but the reducer should never run
        // because the operationName doesn't match. So the number of
        observableQuery2 = client.watchQuery({
          query,
          reducer: (previousResult, action) => {
            if (isMutationResultAction(action) && action.operationName === 'wrongName') {
              counter++; // shouldn't be called, so counter shouldn't increase.
              const newResult = cloneDeep(previousResult) as any;
              newResult.todoList.todos.unshift(action.result.data!['createTodo']);
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
      .then(() => {
        // TODO: improve this test. Now it just works because this query is the same as the watchQuery with the reducer.
        return client.query({ query });
      })
      .then((newResult: any) => {
        observableQuery.unsubscribe();

        // The reducer should have been called once
        assert.equal(counter, 1);

        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('is called on query result as well', () => {
      let counter = 0;
      let observableQuery: any;

      return setup({
        request: { query: mutation },
        result: mutationResult,
      }, {
        request: { query: query2 },
        result: result2,
      })
      .then(() => {
        observableQuery = client.watchQuery({
          query,
          reducer: (previousResult, action) => {
            counter++;
            if (isQueryResultAction(action)) {
              const newResult = cloneDeep(previousResult) as any;
              newResult.todoList.todos.unshift(action.result.data!['newTodos'][0]);
              return newResult;
            }
            return previousResult;
          },
        }).subscribe({
          next: () => null, // TODO: we should actually check the new result
        });
      })
      .then(() => {
        return client.query({ query: query2 });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        observableQuery.unsubscribe();

        // The reducer should have been called once
        assert.equal(counter, 1);

        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'Recently added');
      });
    });

    /*
    it('runs multiple reducers', () => {
      //
      // TODO This test has sometimes failed on CI in the past, but I cannot reproduce it locally.
      // Could be some sort of race condition. Commenting it out for now, but this should be fixed.
      //
      let counter = 0;
      let counter2 = 0;
      let observableQuery: any;
      let observableQuery2: any;

      const filteredQuery = gql`
        query filteredQuery {
          __typename
          todoList(id: 5){
            id
            __typename
            filteredTodos: todos(completed: true) {
              __typename
              id
              text
              completed
            }
          }
        }
      `;

      const filteredResponse = {
        data: {
          __typename: 'Query',
          todoList: {
            __typename: 'TodoList',
            id: 5,
            filteredTodos: [{
              id: 1,
              __typename: 'Todo',
              text: 'filtered todo',
              completed: true,
            }],
          },
        },
      };

      return setup({
        request: { query: mutation },
        result: mutationResult,
      }, {
        request: { query: query2 },
        result: result2,
      }, {
        request: { query: filteredQuery },
        result: filteredResponse,
      })
      .then(() => {
        observableQuery = client.watchQuery({
          query,
          notifyOnNetworkStatusChange: false,
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
        observableQuery2 = client.watchQuery({
          query: filteredQuery,
          fetchPolicy: 'network-only', // need force-fetch to get the filteredTodos,
          reducer: (previousResult, action) => {
            counter2++;
            if (isMutationResultAction(action) && action.result.data!['createTodo'].completed) {
              const newResult = cloneDeep(previousResult) as any;
              newResult.todoList.filteredTodos.unshift(action.result.data!['createTodo']);
              return newResult;
            }
            return previousResult;
          },
        }).subscribe({
          next: () => null, // TODO: we should actually check the new result
        });
      })
      .then(() => {
        return client.mutate({
          mutation,
        });
      })
      .then(() => {
        // TODO: improve this test. Now it just works because this query is the same as the watchQuery with the reducer.
        return client.query({ query });
      })
      .then((newResult: any) => {
        observableQuery.unsubscribe();

        // The reducer should have been called twice. once for the mutation, once for the query
        assert.equal(counter, 2);

        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      })
      .then(() => {
        // TODO: improve this test. Now it just works because this query is the same as the watchQuery with the reducer.
        return client.query({ query: filteredQuery });
      })
      .then((newResult: any) => {
        observableQuery2.unsubscribe();

        // The reducer should have been called twice
        // once for the mutation result, and once for its own query result!!!
        assert.equal(counter2, 2);

        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.filteredTodos.length, 2); // XXX this test sometimes fails in CI

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.filteredTodos[0].text, 'This one was created with a mutation.');
      });
    }); */

    it('does not fail if the query is still loading', () => {
      // XXX we don't check here that the resolver still runs, we just check that no errors are thrown.
      // The resolver doesn't actually run.
      function setupReducerObsHandle(...mockedResponses: any[]) {
        networkInterface = mockNetworkInterface({
          request: { query: queryWithTypename },
          result,
          delay: 30,
        }, ...mockedResponses);

        client = new ApolloClient({
          networkInterface,
          addTypename: true,
          dataIdFromObject: (obj: any) => {
            if (obj.id && obj.__typename) {
              return obj.__typename + obj.id;
            }
            return null;
          },
        });

        return client.watchQuery({
          query,
          reducer: (state, action) => {
            if (isMutationResultAction(action)) {
              // when the mutation returns, the query is still loading
              assert.deepEqual(state, {});
            }
            return state;
          },
        });
      }

      const obsHandle = setupReducerObsHandle({
        request: { query: mutation },
        result: mutationResult,
      });
      const subs = obsHandle.subscribe({
        next: () => null,
      });
      return client.mutate({
        mutation,
      }).then(res => {
        subs.unsubscribe();
      });
    });

    describe('error handling', () => {
      const oldWarn = console.warn;
      let warned: any;
      let timesWarned = 0;

      beforeEach((done) => {
        // clear warnings
        warned = null;
        timesWarned = 0;
        // mock warn method
        console.warn = (...args: any[]) => {
          warned = args;
          timesWarned++;
        };
        done();
      });

      it('does not swallow errors', done => {
        client = new ApolloClient({
          networkInterface: mockNetworkInterface({
            request: { query: queryWithTypename },
            result,
          }),
        });

        const observable = client.watchQuery({
          query,
          reducer: () => {
            throw new Error('Don’t swallow me right up!');
          },
        });

        observable.subscribe({
          next: () => {
            done(new Error('`next` should not be called.'));
          },
          error: error => {
            assert(/swallow/.test(error.message));
            assert(/swallow/.test(warned[1].message));
            assert.equal(timesWarned, 1);
            done();
          },
        });
      });

      afterEach((done) => {
        // restore standard method
        console.warn = oldWarn;
        done();
      });
    });
  });


  describe('updateQueries', () => {
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

    it('analogous of ARRAY_INSERT', () => {
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
        return client.mutate({
          mutation,
          updateQueries: {
            todoList: (prev, options) => {
              const mResult = options.mutationResult as any;
              assert.equal(mResult.data.createTodo.id, '99');
              assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

              const state = cloneDeep(prev) as any;
              state.todoList.todos.unshift(mResult.data.createTodo);
              return state;
            },
          },
        });
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

    it('does not fail if optional query variables are not supplied', () => {
      let subscriptionHandle: Subscription;
      const mutationWithVars = gql`
          mutation createTodo($requiredVar: String!, $optionalVar: String) {
              createTodo(requiredVar: $requiredVar, optionalVar:$optionalVar) {
                  id
                  text
                  completed
                  __typename
              }
              __typename
          }
      `;

      // the test will pass if optionalVar is uncommented
      const variables = {
        requiredVar: 'x',
        // optionalVar: 'y',
      };
      return setup({
        request: {
          query: mutationWithVars,
          variables,
        },
        result: mutationResult,
      })
      .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise((resolve, reject) => {
          const handle = client.watchQuery({
            query,
            variables,
          });
          subscriptionHandle = handle.subscribe({
            next(res) {
              resolve(res);
            },
          });
        });
      })
      .then(() => {
        return client.mutate({
          mutation: mutationWithVars,
          variables,
          updateQueries: {
            todoList: (prev, options) => {
              const mResult = options.mutationResult as any;
              assert.equal(mResult.data.createTodo.id, '99');
              assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

              const state = cloneDeep(prev) as any;
              state.todoList.todos.unshift(mResult.data.createTodo);
              return state;
            },
          },
        });
      })
      .then(() => {
        return client.query({query});
      })
      .then((newResult: any) => {
        subscriptionHandle.unsubscribe();

        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('does not fail if the query did not complete correctly', () => {
      const obsHandle = setupObsHandle({
        request: { query: mutation },
        result: mutationResult,
      });
      const subs = obsHandle.subscribe({
        next: () => null,
      });
      // Cancel the query right away!
      subs.unsubscribe();
      return client.mutate({
        mutation,
        updateQueries: {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;
            assert.equal(mResult.data.createTodo.id, '99');
            assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        },
      });
    });

    it('does not fail if the query did not finish loading', () => {
      const obsHandle = setupDelayObsHandle(
        15,
        {
          request: { query: mutation },
          result: mutationResult,
        },
      );
      const subs = obsHandle.subscribe({
        next: () => null,
      });
      return client.mutate({
        mutation,
        updateQueries: {
          todoList: (prev, options) => {
            const mResult = options.mutationResult as any;
            assert.equal(mResult.data.createTodo.id, '99');
            assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

            const state = cloneDeep(prev) as any;
            state.todoList.todos.unshift(mResult.data.createTodo);
            return state;
          },
        },
      });
    });

    it('does not make next queries fail if a mutation fails', (done) => {
      const obsHandle = setupObsHandle({
        request: { query: mutation },
        result: {errors: [new Error('mock error')]},
      }, {
        request: { query: queryWithTypename },
        result,
      });

      obsHandle.subscribe({
        next(obj) {
          client.mutate({
            mutation,
            updateQueries: {
              todoList: (prev, options) => {
                const mResult = options.mutationResult as any;
                const state = cloneDeep(prev) as any;
                // It's unfortunate that this function is called at all, but we are removing
                // the updateQueries API soon so it won't matter.
                state.todoList.todos.unshift(mResult.data && mResult.data.createTodo);
                return state;
              },
            },
          })
          .then(
            () => done(new Error('Mutation should have failed')),
            () => client.mutate({
              mutation,
              updateQueries: {
                todoList: (prev, options) => {
                  const mResult = options.mutationResult as any;
                  const state = cloneDeep(prev) as any;
                  state.todoList.todos.unshift(mResult.data.createTodo);
                  return state;
                },
              },
            }),
          )
          .then(
            () => done(new Error('Mutation should have failed')),
            () => obsHandle.refetch(),
          )
          .then(() => done(), done);
        },
      });
    });

    it('error handling in reducer functions', () => {
      const oldError = console.error;
      const errors: any[] = [];
      console.error = (msg: string) => {
        errors.push(msg);
      };

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
        return client.mutate({
          mutation,
          updateQueries: {
            todoList: (prev, options) => {
              throw new Error(`Hello... It's me.`);
            },
          },
        });
      })
      .then(() => {
        subscriptionHandle.unsubscribe();
        assert.lengthOf(errors, 1);
        assert.equal(errors[0].message, `Hello... It's me.`);
        console.error = oldError;
      });
    });
  });

  it('does not fail if one of the previous queries did not complete correctly', (done) => {
    const variableQuery = gql`
      query Echo($message: String) {
        echo(message: $message)
      }
    `;

    const variables1 = {
      message: 'a',
    };

    const result1 = {
      data: {
        echo: 'a',
      },
    };

    const variables2 = {
      message: 'b',
    };

    const result2 = {
      data: {
        echo: 'b',
      },
    };

    const resetMutation = gql`
      mutation Reset {
        reset {
          echo
        }
      }
    `;

    const resetMutationResult = {
      data: {
        reset: {
          echo: '0',
        },
      },
    };

    networkInterface = mockNetworkInterface({
      request: { query: variableQuery, variables: variables1 },
      result: result1,
    }, {
      request: { query: variableQuery, variables: variables2 },
      result: result2,
    }, {
      request: { query: resetMutation },
      result: resetMutationResult,
    });

    client = new ApolloClient({
      networkInterface,
      addTypename: false,
    });

    const watchedQuery = client.watchQuery({
      query: variableQuery,
      variables: variables1,
    });

    const firstSubs = watchedQuery.subscribe({
      next: () => null,
      error: done,
    });

    // Cancel the query right away!
    firstSubs.unsubscribe();

    let yieldCount = 0;
    watchedQuery.subscribe({
      next: ({data}: any) => {
        yieldCount += 1;
        if (yieldCount === 1) {
          assert.equal(data.echo, 'b');
          client.mutate({
            mutation: resetMutation,
            updateQueries: {
              Echo: (prev, options) => {
                return {echo: '0'};
              },
            },
          });
        } else if (yieldCount === 2) {
          assert.equal(data.echo, '0');
          done();
        }
      },
      error: () => {
        // Do nothing, but quash unhandled error
      },
    });

    watchedQuery.refetch(variables2);
  });

  it('allows mutations with optional arguments', done => {
    let count = 0;

    client = new ApolloClient({
      addTypename: false,
      networkInterface: {
        query ({ variables }) {
          switch (count++) {
            case 0:
              assert.deepEqual(variables, { a: 1, b: 2 });
              return Promise.resolve({ data: { result: 'hello' } });
            case 1:
              assert.deepEqual(variables, { a: 1, c: 3 });
              return Promise.resolve({ data: { result: 'world' } });
            case 2:
              assert.deepEqual(variables, { a: undefined, b: 2, c: 3 });
              return Promise.resolve({ data: { result: 'goodbye' } });
            case 3:
              assert.deepEqual(variables, {});
              return Promise.resolve({ data: { result: 'moon' } });
            default:
              return Promise.reject(new Error('Too many network calls.'));
          }
        },
      },
    });

    const mutation = gql`
      mutation ($a: Int!, $b: Int, $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: 2 },
      }),
      client.mutate({
        mutation,
        variables: { a: 1, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { a: undefined, b: 2, c: 3 },
      }),
      client.mutate({
        mutation,
      }),
    ]).then(() => {
      assert.deepEqual(client.queryManager.getApolloState().data, {
        ROOT_MUTATION: {
          'result({"a":1,"b":2})': 'hello',
          'result({"a":1,"c":3})': 'world',
          'result({"b":2,"c":3})': 'goodbye',
          'result({})': 'moon',
        },
      });
      done();
    }).catch(done);
  });

  it('allows mutations with default values', done => {
    let count = 0;

    client = new ApolloClient({
      addTypename: false,
      networkInterface: {
        query ({ variables }) {
          switch (count++) {
            case 0:
              assert.deepEqual(variables, { a: 1, b: 'water' });
              return Promise.resolve({ data: { result: 'hello' } });
            case 1:
              assert.deepEqual(variables, { a: 2, b: 'cheese', c: 3 });
              return Promise.resolve({ data: { result: 'world' } });
            case 2:
              assert.deepEqual(variables, { a: 1, b: 'cheese', c: 3 });
              return Promise.resolve({ data: { result: 'goodbye' } });
            default:
              return Promise.reject(new Error('Too many network calls.'));
          }
        },
      },
    });

    const mutation = gql`
      mutation ($a: Int = 1, $b: String = "cheese", $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: 'water' },
      }),
      client.mutate({
        mutation,
        variables: { a: 2, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { c: 3 },
      }),
    ]).then(() => {
      assert.deepEqual(client.queryManager.getApolloState().data, {
        ROOT_MUTATION: {
          'result({"a":1,"b":"water"})': 'hello',
          'result({"a":2,"b":"cheese","c":3})': 'world',
          'result({"a":1,"b":"cheese","c":3})': 'goodbye',
        },
      });
      done();
    }).catch(done);
  });

  it('will pass null to the network interface when provided', done => {
    let count = 0;

    client = new ApolloClient({
      addTypename: false,
      networkInterface: {
        query ({ variables }) {
          switch (count++) {
            case 0:
              assert.deepEqual(variables, { a: 1, b: 2, c: null });
              return Promise.resolve({ data: { result: 'hello' } });
            case 1:
              assert.deepEqual(variables, { a: 1, b: null, c: 3 });
              return Promise.resolve({ data: { result: 'world' } });
            case 2:
              assert.deepEqual(variables, { a: null, b: null, c: null });
              return Promise.resolve({ data: { result: 'moon' } });
            default:
              return Promise.reject(new Error('Too many network calls.'));
          }
        },
      },
    });

    const mutation = gql`
      mutation ($a: Int!, $b: Int, $c: Int) {
        result(a: $a, b: $b, c: $c)
      }
    `;

    Promise.all([
      client.mutate({
        mutation,
        variables: { a: 1, b: 2, c: null },
      }),
      client.mutate({
        mutation,
        variables: { a: 1, b: null, c: 3 },
      }),
      client.mutate({
        mutation,
        variables: { a: null, b: null, c: null },
      }),
    ]).then(() => {
      assert.deepEqual(client.queryManager.getApolloState().data, {
        ROOT_MUTATION: {
          'result({"a":1,"b":2,"c":null})': 'hello',
          'result({"a":1,"b":null,"c":3})': 'world',
          'result({"a":null,"b":null,"c":null})': 'moon',
        },
      });
      done();
    }).catch(done);
  });

  describe('store transaction updater', () => {
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

    it('analogous of ARRAY_INSERT', () => {
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
        return client.mutate({
          mutation,
          update: (proxy, mResult: any) => {
            assert.equal(mResult.data.createTodo.id, '99');
            assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

            const id = 'TodoList5';
            const fragment = gql`fragment todoList on TodoList { todos { id text completed __typename } }`;

            const data: any = proxy.readFragment({ id, fragment });

            proxy.writeFragment({
              data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
              id, fragment,
            });
          },
        });
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

    it('does not fail if optional query variables are not supplied', () => {
      let subscriptionHandle: Subscription;
      const mutationWithVars = gql`
          mutation createTodo($requiredVar: String!, $optionalVar: String) {
              createTodo(requiredVar: $requiredVar, optionalVar:$optionalVar) {
                  id
                  text
                  completed
                  __typename
              }
              __typename
          }
      `;

      // the test will pass if optionalVar is uncommented
      const variables = {
        requiredVar: 'x',
        // optionalVar: 'y',
      };
      return setup({
        request: {
          query: mutationWithVars,
          variables,
        },
        result: mutationResult,
      })
      .then(() => {
        // we have to actually subscribe to the query to be able to update it
        return new Promise((resolve, reject) => {
          const handle = client.watchQuery({
            query,
            variables,
          });
          subscriptionHandle = handle.subscribe({
            next(res) {
              resolve(res);
            },
          });
        });
      })
      .then(() => {
        return client.mutate({
          mutation: mutationWithVars,
          variables,
          update: (proxy, mResult: any) => {
            assert.equal(mResult.data.createTodo.id, '99');
            assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

            const id = 'TodoList5';
            const fragment = gql`fragment todoList on TodoList { todos { id text completed __typename } }`;

            const data: any = proxy.readFragment({ id, fragment });

            proxy.writeFragment({
              data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
              id, fragment,
            });
          },
        });
      })
      .then(() => {
        return client.query({query});
      })
      .then((newResult: any) => {
        subscriptionHandle.unsubscribe();

        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `prepend` it should be at the front
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');
      });
    });

    it('does not make next queries fail if a mutation fails', (done) => {
      const obsHandle = setupObsHandle({
        request: { query: mutation },
        result: {errors: [new Error('mock error')]},
      }, {
        request: { query: queryWithTypename },
        result,
      });

      obsHandle.subscribe({
        next(obj) {
          client.mutate({
            mutation,
            update: (proxy, mResult: any) => {
              assert.equal(mResult.data.createTodo.id, '99');
              assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

              const id = 'TodoList5';
              const fragment = gql`fragment todoList on TodoList { todos { id text completed __typename } }`;

              const data: any = proxy.readFragment({ id, fragment });

              proxy.writeFragment({
                data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
                id, fragment,
              });
            },
          })
          .then(
            () => done(new Error('Mutation should have failed')),
            () => client.mutate({
              mutation,
              update: (proxy, mResult: any) => {
                assert.equal(mResult.data.createTodo.id, '99');
                assert.equal(mResult.data.createTodo.text, 'This one was created with a mutation.');

                const id = 'TodoList5';
                const fragment = gql`fragment todoList on TodoList { todos { id text completed __typename } }`;

                const data: any = proxy.readFragment({ id, fragment });

                proxy.writeFragment({
                  data: { ...data, todos: [mResult.data.createTodo, ...data.todos] },
                  id, fragment,
                });
              },
            }),
          )
          .then(
            () => done(new Error('Mutation should have failed')),
            () => obsHandle.refetch(),
          )
          .then(() => done(), done);
        },
      });
    });

    it('error handling in reducer functions', () => {
      const oldError = console.error;
      const errors: any[] = [];
      console.error = (msg: string) => {
        errors.push(msg);
      };

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
        return client.mutate({
          mutation,
          update: () => {
            throw new Error(`Hello... It's me.`);
          },
        });
      })
      .then(() => {
        subscriptionHandle.unsubscribe();
        assert.lengthOf(errors, 1);
        assert.equal(errors[0].message, `Hello... It's me.`);
        console.error = oldError;
      });
    });
  });
});
