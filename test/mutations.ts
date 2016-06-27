import { assert } from 'chai';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient from '../src';

import gql from 'graphql-tag';

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
      }
    }
  `;

  const result = {
    data: {
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

  let client;
  let networkInterface;
  beforeEach((done) => {
    networkInterface = mockNetworkInterface({
      request: { query },
      result,
    });

    client = new ApolloClient({ networkInterface });

    client.query({
      query,
    }).then(() => done());
  });

  it('correctly primes cache for tests', () => {
    return client.query({
      query,
    });
  });
});
