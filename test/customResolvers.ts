import mockNetworkInterface from './mocks/mockNetworkInterface';
import gql from 'graphql-tag';
import { assert } from 'chai';
import ApolloClient, { toIdValue } from '../src';

import { NetworkStatus } from '../src/queries/networkStatus';

describe('custom resolvers', () => {
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
          person: (_, args) => toIdValue(args['id']),
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
        stale: false,
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
});
