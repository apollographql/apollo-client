import {assert} from 'chai';
import mockNetworkInterface from './mocks/mockNetworkInterface';
import gql from 'graphql-tag';
import ApolloClient from '../src/ApolloClient';
import {cloneDeep} from '../src/util/cloneDeep';

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
    data: {
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
        assert.deepEqual(result.data, data.data);

        assert.deepEqual(client.store.getState().apollo.cache, {
          data: initialState.apollo.data,
          queryCache: {
            '1': {
              dirty: false,
              modified: false,
              result: data.data,
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
      request: { query },
      result: data,
    });

    const client = new ApolloClient({
      networkInterface,
      addTypename: false,
      dataIdFromObject: (obj: any) => obj.id,
    });

    return client.query({ query })
      .then((result: any) => {
        assert.deepEqual(result.data, data.data);

        assert.deepEqual(client.store.getState().apollo.cache, {
          data: initialState.apollo.data,
          queryCache: {
            '1': {
              dirty: false,
              modified: false,
              result: data.data,
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

  describe('with mutation and update queries', () => {
    const mutation = gql`
        mutation dummyMutation {
            id
        }
    `;

    const mutationResult = {
      data: {
        id: 'dummy',
      },
    };

    const setupClient = (): ApolloClient => {
      const networkInterface = mockNetworkInterface({
        request: {query},
        result: data,
      }, {
        request: {query: mutation},
        result: mutationResult,
      });

      return new ApolloClient({
        networkInterface,
        addTypename: false,
        dataIdFromObject: (obj: any) => obj.id,
      });
    };

    it('is dirty with update store flag true', done => {
      const expectedData = cloneDeep(initialState.apollo.data);
      expectedData['ROOT_MUTATION'] = {id: 'dummy'};
      expectedData['account1'].name = 'Account 1 (updated)';

      const expectedResult = cloneDeep(data.data);
      expectedResult.node.name = 'Account 1 (updated)';

      let expectedCache = {
        data: expectedData,
        queryCache: {
          '1': {
            dirty: true,
            modified: false,
            result: expectedResult,
            variables: {},
            keys: {
              'ROOT_QUERY.node({"id":"account1"})': true,
              'account1': true,
              'user1': true,
              'user2': true,
            },
          },
        },
      };

      const client = setupClient();

      let c = 0;
      client.watchQuery({query}).subscribe({
        next: (result: any) => {
          switch (c++) {
            case 0:
              assert.deepEqual(result.data, data.data);

              client.mutate({
                mutation,
                updateQueries: {
                  account: (prev: any) => {
                    const newData = cloneDeep(prev);
                    newData.node.name = 'Account 1 (updated)';
                    return newData;
                  },
                },
              }).then(() => {
                assert.deepEqual(client.store.getState().apollo.cache, expectedCache);
              });
              break;
            case 1:
              expectedCache.queryCache['1'].dirty = false;
              assert.deepEqual(client.store.getState().apollo.cache, expectedCache);
              done();
              break;
            default:
              done(new Error('`next` was called to many times.'));
          }
        },
      });
    });

    it('is not dirty and modified with update store flag false', done => {
      const expectedData = cloneDeep(initialState.apollo.data);
      expectedData['ROOT_MUTATION'] = {id: 'dummy'};

      const expectedResult = cloneDeep(data.data);
      expectedResult.node.name = 'Account 1 (updated)';

      let expectedCache = {
        data: expectedData,
        queryCache: {
          '1': {
            dirty: false,
            modified: true,
            result: expectedResult,
            variables: {},
            keys: {
              'ROOT_QUERY.node({"id":"account1"})': true,
              'account1': true,
              'user1': true,
              'user2': true,
            },
          },
        },
      };

      const client = setupClient();

      let c = 0;
      client.watchQuery({ query }).subscribe({
        next: (result: any) => {
          switch (c++) {
            case 0:
              assert.deepEqual(result.data, data.data);

              client.mutate({
                mutation,
                updateQueries: {
                  account: (prev: any, options: any) => {
                    const newData = cloneDeep(prev);
                    newData.node.name = 'Account 1 (updated)';

                    options.updateStoreFlag = false;

                    return newData;
                  },
                },
              }).then(() => {
                assert.deepEqual(client.store.getState().apollo.cache, expectedCache);
              });
              break;
            case 1:
              assert.deepEqual(client.store.getState().apollo.cache, expectedCache);
              done();
              break;
            default:
              done(new Error('`next` was called to many times.'));
          }
        },
      });
    });
  });
});
