import gql from 'graphql-tag';

import {
  ApolloClient,
  createNetworkInterface,
} from '../src/index';

import mockNetworkInterface from '../test/mocks/mockNetworkInterface';

const Benchmark = require('benchmark');
const bsuite = new Benchmark.Suite();

bsuite
  .add('construct instance', () => {
    new ApolloClient({});
  })
  .add('create network interface', () => {
    createNetworkInterface({
      uri: '/graphql',
    });
  })
  .add('fetch a query result from mocked server', () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }`;
    const client = new ApolloClient({
      networkInterface: mockNetworkInterface({
        request: { query },
        result: {
          data: {
            author: {
              firstName: 'John',
              lastName: 'Smith',
            },
          },
        },
      }),
    });
    client.query(query).then((result) => {
      console.log(result);
    });
  })
  .on('cycle', function(event: any) {
    console.log('Mean time in seconds: ')
    console.log(event.target.stats.mean);
    console.log(String(event.target));
  })
  .run({'async': true});
