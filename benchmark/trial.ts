import gql from 'graphql-tag';

import {
  ApolloClient,
  ApolloQueryResult,
  ObservableQuery
} from '../src/index';

import mockNetworkInterface from '../test/mocks/mockNetworkInterface';

import {
  Deferred, 
} from 'benchmark';

const Benchmark = require('benchmark');
const bsuite = new Benchmark.Suite();

let globalClient: ApolloClient = null;
let globalObservableQuery: ObservableQuery<Object> = null;

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
  .add('write data and receive update from the cache in dev', {
    // Should benchmark writing a query result to
    // the cache that affects another query in "development"
    // mode, i.e. no deep freezing.
    defer: true,
    fn: (deferred: any) => {
      const client = new ApolloClient({
        networkInterface: mockNetworkInterface(simpleReqResp),
        addTypename: false,
      });
      
      const observable = client.watchQuery({
        query: simpleQuery,
        noFetch: true,
      });
      observable.subscribe({
        next(res: ApolloQueryResult<Object>) {
          if(Object.keys(res.data).length > 0) {
            deferred.resolve();
          }
        },
        
        error(err: Error) {
          console.log('Error happened: ', err);
        }
      });
      client.query({ query: simpleQuery }); 
    }
  })/*
  .add('write data and receive update from the cache in prod', {
    // Should benchmark writing a query result to the cache
    // that affects another query in "production" mode, i.e.
    // with deep freezing.
  })
  .add('store state writes', {
    // Should benchmark a single update to store state that (currently)
    // results in a clone of the store state.
  }) */
  .on('cycle', function(event: any) {
    console.log('Mean time in ms: ', event.target.stats.mean * 1000);
    console.log(String(event.target));
  })
  .on('error', function(event: any) {
    console.log('Error in event. Event object: ');
    console.log(event);
  })
  .run({'async': true});
