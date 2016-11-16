import mockNetworkInterface from './mocks/mockNetworkInterface';
import gql from 'graphql-tag';
import { assert } from 'chai';
import ApolloClient from '../src';
import { createStore, combineReducers, applyMiddleware } from 'redux';

import { NetworkStatus } from '../src/queries/store';

describe('custom resolvers', () => {
  it(`works with client-side computed fields`, () => {
    const query = gql`
      {
        person {
          firstName
          lastName
          fullName @client
        }
      }
    `;

    const data = {
      person: {
        firstName: 'Luke',
        lastName: 'Skywalker',
        __typename: 'Person',
      },
    };

    const netQuery = gql`
      {
        person {
          firstName
          lastName
          __typename
        }
      }
    `;

    const networkInterface = mockNetworkInterface({
      request: { query: netQuery },
      result: { data },
    });

    const client = new ApolloClient({
      networkInterface,
      customResolvers: {
        Person: {
          fullName: (root) => root.firstName + ' ' + root.lastName,
        },
      },
    });

    return client.query({ query }).then((result) => {
      assert.deepEqual(result.data, {
        person: {
          firstName: 'Luke',
          lastName: 'Skywalker',
          fullName: 'Luke Skywalker',
          __typename: 'Person',
        },
      });
    });
  });

  it(`works for cache redirection`, () => {
    const dataIdFromObject = (obj: any) => {
      return obj.id;
    };

    const listQuery = gql`{ people { id name } }`;

    const listData = {
      people: [
        {
          id: '4',
          name: 'Luke Skywalker',
          __typename: 'Person',
        },
      ],
    };

    const netListQuery = gql`{ people { id name __typename } }`;

    const itemQuery = gql`{ person(id: 4) { id name } }`;

    // We don't expect the item query to go to the server at all
    const networkInterface = mockNetworkInterface({
      request: { query: netListQuery },
      result: { data: listData },
    });

    const client = new ApolloClient({
      networkInterface,
      customResolvers: {
        Query: {
          person: (_, args) => {
            return {
              type: 'id',
              id: args['id'],
              generated: false,
            };
          },
        },
      },
      dataIdFromObject,
    });

    return client.query({ query: listQuery }).then(() => {
      return client.query({ query: itemQuery });
    }).then((itemResult) => {
      assert.deepEqual(itemResult, {
        loading: false,
        networkStatus: NetworkStatus.ready,
        data: {
          person: {
            __typename: 'Person',
            id: '4',
            name: 'Luke Skywalker',
          },
        },
      });
    });
  });

  it(`works for Redux reading`, () => {
    const dataIdFromObject = (obj: any) => {
      return obj.id;
    };

    const listQuery = gql`{
      people {
        id
        name
        checked @client
      }
    }`;

    const listData = {
      people: [
        {
          id: '4',
          name: 'Luke Skywalker',
          __typename: 'Person',
        },
        {
          id: '5',
          name: 'Darth Vader',
          __typename: 'Person',
        },
      ],
    };

    const netListQuery = gql`{ people { id name __typename } }`;

    const networkInterface = mockNetworkInterface({
      request: { query: netListQuery },
      result: { data: listData },
    });

    let store: any;

    const client = new ApolloClient({
      networkInterface,
      customResolvers: {
        Person: {
          checked: (person) => {
            return store.getState().marked[person.id] || false;
          },
        },
      },
      dataIdFromObject,
    });

    const markedReducer = (state: any, action: any) => state || {};

    store = createStore(
      combineReducers({
        marked: markedReducer,
        apollo: client.reducer() as any,
      }),
      {
        marked: {
          4: true,
        },
      } as any,
      applyMiddleware(client.middleware())
    );

    return client.query({ query: listQuery }).then((result) => {
      assert.deepEqual(result, {
        'data': {
          'people': [
            {
              '__typename': 'Person',
              'checked': true,
              'id': '4',
              'name': 'Luke Skywalker',
            },
            {
              '__typename': 'Person',
              'checked': false,
              'id': '5',
              'name': 'Darth Vader',
            },
          ],
        },
        'loading': false,
        networkStatus: NetworkStatus.ready,
      });
    });
  });
});
