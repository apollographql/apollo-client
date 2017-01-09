import gql from 'graphql-tag';

import {
  ApolloClient,
} from '../src/index';

import mockNetworkInterface from '../test/mocks/mockNetworkInterface';

import {
  Deferred, 
} from 'benchmark';

const Benchmark = require('benchmark');
const bsuite = new Benchmark.Suite();

let globalClient: ApolloClient = null;
const simpleQuery = gql`
  query {
    author {
      firstName
      lastName
    }
}`;
const simpleResult = {
  data: {
    author: {
      firstName: 'John',
      lastName: 'Smith',
    },
  },
};
const simpleReqResp = {
  request: { query: simpleQuery },
  result: simpleResult,
};

bsuite
  .add('construct instance', () => {
    new ApolloClient({});
  })
  .add('fetch a query result from mocked server', {
    defer: true,
    setup: () => {
      globalClient = new ApolloClient({
        networkInterface: mockNetworkInterface({
          request: { query: simpleQuery },
          result: simpleResult,
        }),
        addTypename: false,
      });
    },
    fn: (deferred: any) => {
      globalClient.query({ query: simpleQuery }).then((result) => {
        deferred.resolve();
      });
    },
  })
  .add('read simple query result from cache', {
    defer: true,
    setup: (deferred: any) => {
      globalClient = new ApolloClient({
        networkInterface: mockNetworkInterface(simpleReqResp),
        addTypename: false,
      });

      // insert the result into the cache
      globalClient.query({ query: simpleQuery }).then((result) => {
        deferred.resolve();
      });
    },
    fn: (deferred: any) => {
      globalClient.query({
        query: simpleQuery,
        noFetch: true,
      }).then((result) => {
        deferred.resolve();
      })
    },
  })
  .on('cycle', function(event: any) {
    console.log('Mean time in ms: ', event.target.stats.mean * 1000);
    console.log(String(event.target));
  })
  .run({'async': true});
