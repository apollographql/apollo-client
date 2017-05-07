import {assert} from 'chai';
import {HeuristicFragmentMatcher} from '../src/data/fragmentMatcher';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import mockQueryManager from './mocks/mockQueryManager';
import gql from 'graphql-tag';
import ApolloClient from '../src/ApolloClient'; import {cloneDeep} from '../src/util/cloneDeep';


describe('query cache', () => {
  const query = gql`
      query account {
          node(id: "account1") {
              id
              name
              owner {
                  id
                  name
              }
              users {
                  id
                  name
              }
          }
      }
  `;

  const data = {
    node: {
      id: 'account1',
      name: 'Account 1',
      owner: {
        id: 'user1',
        name: 'User 1',
      },
      users: [
        {
          id: 'user1',
          name: 'User 1',
        },
        {
          id: 'user2',
          name: 'User 2',
        },
      ],
    },
  };

  const initialState: any = {
    apollo: {
      data: {
        'ROOT_QUERY': {
          'node({"id":"account1"})': {
            'generated': false,
            'id': 'account1',
            'type': 'id',
          },
        },
        'account1': {
          'id': 'account1',
          'name': 'Account 1',
          'owner': {
            'generated': false,
            'id': 'user1',
            'type': 'id',
          },
          'users': [
            {
              'generated': false,
              'id': 'user1',
              'type': 'id',
            },
            {
              'generated': false,
              'id': 'user2',
              'type': 'id',
            },
          ],
        },
        'user1': {
          'id': 'user1',
          'name': 'User 1',
        },
        'user2': {
          'id': 'user2',
          'name': 'User 2',
        },
      },
    },
  };

  it('is inserted when provided initial state with data for query', () => {
    const networkInterface = mockNetworkInterface();

    const client = new ApolloClient({
      networkInterface,
      initialState,
      addTypename: false,
      dataIdFromObject: (obj: any) => obj.id,
    });

    return client.query({query, fetchPolicy: 'cache-only'})
      .then((result: any) => {
        assert.deepEqual(result.data, data);

        assert.deepEqual(client.store.getState().apollo.cache, {
          data: initialState.apollo.data,
          queryCache: {
            '1': {
              dirty: false,
              modified: false,
              result: data,
              variables: {},
              keys: {
                'ROOT_QUERY.node({"id":"account1"})': true,
                'account1': true,
                'user1': true,
                'user2': true,
              },
            },
          },
        });
      });
  });

  it('is inserted after requesting a query over the network', () => {
    const networkInterface = mockNetworkInterface({
      request: {query},
      result: {data},
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
      dataIdFromObject: (obj: any) => obj.id,
    });

    return client.query({query})
      .then((result: any) => {
        assert.deepEqual(result.data, data);

        const cache = client.store.getState().apollo.cache;

        assert.deepEqual(client.store.getState().apollo.cache, {
          data: initialState.apollo.data,
          queryCache: {
            '1': {
              dirty: false,
              modified: false,
              result: data,
              variables: {},
              keys: {
                'ROOT_QUERY.node({"id":"account1"})': true,
                'account1': true,
                'user1': true,
                'user2': true,
              },
            },
          },
        });
      });
  });
});
