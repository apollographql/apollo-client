import mockNetworkInterface from './mocks/mockNetworkInterface';
import gql from 'graphql-tag';
import { assert } from 'chai';
import ApolloClient from '../src';

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
            return args['id'];
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
