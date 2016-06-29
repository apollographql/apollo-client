import { assert } from 'chai';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient, { addTypename } from '../src';
import { MutationBehaviorReducerArgs, MutationBehavior } from '../src/data/mutationResults';
import { NormalizedCache, StoreObject } from '../src/data/store';

import assign = require('lodash.assign');

import gql from 'graphql-tag';

describe('mutation results', () => {
  const query = gql`
    query todoList {
      __typename
      todoList(id: 5) {
        __typename
        id
        todos {
          __typename
          id
          text
          completed
        }
      }
    }
  `;

  const result = {
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
      },
    },
  };

  let client: ApolloClient;
  let networkInterface;

  type CustomMutationBehavior = {
    type: 'CUSTOM_MUTATION_RESULT',
    dataId: string,
    field: string,
    value: any,
  }

  // This is an example of a basic mutation reducer that just sets a field in the store
  function customMutationReducer(state: NormalizedCache, {
    behavior,
  }: MutationBehaviorReducerArgs): NormalizedCache {
    const customBehavior = behavior as any as CustomMutationBehavior;

    state[customBehavior.dataId] = assign({}, state[customBehavior.dataId], {
      [customBehavior.field]: customBehavior.value,
    }) as StoreObject;

    return state;
  }

  function setup(...mockedResponses) {
    networkInterface = mockNetworkInterface({
      request: { query },
      result,
    }, ...mockedResponses);

    client = new ApolloClient({
      networkInterface,
      queryTransformer: addTypename,
      dataIdFromObject: (obj: any) => {
        if (obj.id && obj.__typename) {
          return obj.__typename + obj.id;
        }
        return null;
      },

      mutationBehaviorReducers: {
        'CUSTOM_MUTATION_RESULT': customMutationReducer,
      },
    });

    return client.query({
      query,
    });
  };

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

  describe('ARRAY_INSERT', () => {
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

    it('correctly integrates a basic object at the beginning', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        const dataId = client.dataId({
          __typename: 'TodoList',
          id: '5',
        });

        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ dataId, 'todos' ],
              where: 'PREPEND',
            },
          ],
        });
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

    it('correctly integrates a basic object at the end', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ 'TodoList5', 'todos' ],
              where: 'APPEND',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 4);

        // Since we used `APPEND` it should be at the end
        assert.equal(newResult.data.todoList.todos[3].text, 'This one was created with a mutation.');
      });
    });

    it('accepts two operations', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ 'TodoList5', 'todos' ],
              where: 'PREPEND',
            }, {
              type: 'ARRAY_INSERT',
              resultPath: [ 'createTodo' ],
              storePath: [ 'TodoList5', 'todos' ],
              where: 'APPEND',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one more todo item than before
        assert.equal(newResult.data.todoList.todos.length, 5);

        // There will be two copies
        assert.equal(newResult.data.todoList.todos[0].text, 'This one was created with a mutation.');

        assert.equal(newResult.data.todoList.todos[4].text, 'This one was created with a mutation.');
      });
    });
  });

  describe('DELETE', () => {
    const mutation = gql`
      mutation deleteTodo {
        # skipping arguments in the test since they don't matter
        deleteTodo {
          id
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        deleteTodo: {
          __typename: 'Todo',
          id: '3',
        },
      },
    };

    it('deletes object from array and store', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'DELETE',
              dataId: 'Todo3',
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one fewer todo item than before
        assert.equal(newResult.data.todoList.todos.length, 2);

        // The item shouldn't be in the store anymore
        assert.notProperty(client.queryManager.getApolloState().data, 'Todo3');
      });
    });
  });

  describe('ARRAY_DELETE', () => {
    const mutation = gql`
      mutation removeTodo {
        # skipping arguments in the test since they don't matter
        removeTodo {
          id
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        removeTodo: {
          __typename: 'Todo',
          id: '3',
        },
      },
    };

    it('deletes an object from array but not store', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'ARRAY_DELETE',
              dataId: 'Todo3',
              storePath: ['TodoList5', 'todos'],
            },
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // There should be one fewer todo item than before
        assert.equal(newResult.data.todoList.todos.length, 2);

        // The item is still in the store
        assert.property(client.queryManager.getApolloState().data, 'Todo3');
      });
    });
  });

  describe('CUSTOM_MUTATION_RESULT', () => {
    const mutation = gql`
      mutation setField {
        # skipping arguments in the test since they don't matter
        setSomething {
          aValue
          __typename
        }
        __typename
      }
    `;

    const mutationResult = {
      data: {
        __typename: 'Mutation',
        setSomething: {
          __typename: 'Value',
          aValue: 'rainbow',
        },
      },
    };

    it('runs the custom reducer', () => {
      return setup({
        request: { query: mutation },
        result: mutationResult,
      })
      .then(() => {
        return client.mutate({
          mutation,
          resultBehaviors: [
            {
              type: 'CUSTOM_MUTATION_RESULT',
              dataId: 'Todo3',
              field: 'text',
              value: 'this is the new text',
            } as any as MutationBehavior,
          ],
        });
      })
      .then(() => {
        return client.query({ query });
      })
      .then((newResult: any) => {
        // Our custom reducer has indeed modified the state!
        assert.equal(newResult.data.todoList.todos[0].text, 'this is the new text');
      });
    });
  });
});
