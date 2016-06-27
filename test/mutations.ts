import { assert } from 'chai';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import ApolloClient, { addTypename } from '../src';

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
          __typename
        }
        __typename
      }
      __typename
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

  let client;
  let networkInterface;
  beforeEach((done) => {
    networkInterface = mockNetworkInterface({
      request: { query },
      result,
    });

    client = new ApolloClient({
      networkInterface,
      // XXX right now this isn't compatible with our mocking
      // strategy...
      // FIX BEFORE PR MERGE
      // queryTransformer: addTypename,
      dataIdFromObject: (obj: any) => {
        if (obj.id && obj.__typename) {
          return obj.__typename + obj.id;
        }
        return null;
      },
    });

    return client.query({
      query,
    })
      .then(() => done())
      .catch((e) => console.log(e));
  });

  it('correctly primes cache for tests', () => {
    return client.query({
      query,
    });
  });
});
