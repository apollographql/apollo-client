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

import {
  times,
} from 'lodash';

const Benchmark = require('benchmark');
// The maximum number of iterations that a benchmark can cycle for
// before it has to enter a setup loop again. This could probably be done through
// the Benchmark.count value but that doesn't seem to be exposed correctly
// to the setup function so we have to do this.
const MAX_ITERATIONS = 100;
const bsuite = new Benchmark.Suite();

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

// This provides several utilities that make it a bit easier to 
// interact with benchmark.js.
//
// Specifically, it provides `group` and `benchmark`, examples of which
// can be seen below.The functions allow you to manage scope and async
// code more easily than benchmark.js typically allows.
// 
// `group` is meant to provide a way to execute code that sets up the scope variables for your
// benchmark. It is only run once before the benchmark, not on every call of the code to
// be benchmarked.
type DoneFunction = () => void;
type CycleFunction = (doneFn: DoneFunction) => void;
type BenchmarkFunction = (description: string, cycleFn: CycleFunction) => void;
type GroupFunction = (done: DoneFunction) => void;
type SetupCycleFunction = () => void;
type SetupFunction = (setupFn: SetupCycleFunction) => void;
let benchmark: BenchmarkFunction = null;
let setup: SetupFunction = null;

const groupPromises: Promise<void>[] = [];
const group = (groupFn: GroupFunction) => {
  const oldBenchmark = benchmark;
  const oldSetup = setup;
  const scope: {
    setup?: SetupFunction,
    benchmark?: BenchmarkFunction,
  } = {};
  
  // This is a very important part of the tooling around benchmark.js.
  //
  // benchmark.js does not allow you run a particular function before
  // every cycle of the benchmark (i.e. you cannot run a particular function
  // before the timed portion of a CycleFunction begins). This makes it
  // difficult to set up initial state. This function solves this problem.
  //
  // Inside each `GroupFunction`, the user can create a `setup` block,
  // passing an instance of `SetupCycleFunction` as an argument. benchmark.js
  // will call the `setup` function below once before running the CycleFunction
  // `count` times. This setup function will then call the SetupCycleFunction it is
  // passed `count` times and record array of scopes that exist within SetupCycleFunction.
  // This array will be available to the `GroupCycleFunction`.
  //
  // This makes it possible to write code in the `SetupCycleFunction`
  // almost as if it is run before every of the `CycleFunction`. Check in the benchmarks
  // themselves for an example of this.
  let setupFn: SetupCycleFunction = null;
  const scopes: Object[] = [];
  let cycleCount = 0;
  scope.setup = (setupFnArg: SetupCycleFunction) => {
    setupFn = setupFnArg;
  };

  const runSetup = () => {
    times(MAX_ITERATIONS, () => {
      setupFn.apply(this);
      scopes.push(this);
    });
  };
  
  scope.benchmark = (description: string, benchmarkFn: (done: () => void) => void) => {
    console.log('Adding benchmark: %s', description);
    bsuite.add(description, {
      defer: true,
      setup: (deferred: any) => {
        if (setupFn !== null) {
          runSetup();
          if (deferred) {
            deferred.resolve();
          }
        }
      },
      fn: (deferred: any) => {
        const done = () => {
          deferred.resolve();
        };
        
        benchmarkFn(done);
      },
    });
  };

  groupPromises.push(new Promise<void>((resolve, reject) => {
    const groupDone = () => {
      resolve();
    };
    
    benchmark = scope.benchmark;
    setup = scope.setup;
    
    groupFn(groupDone);
    
    benchmark = oldBenchmark;
    setup = oldSetup;
  }));
};

const getClientInstance = () => {
  return new ApolloClient({
    networkInterface: mockNetworkInterface({
      request: { query: simpleQuery },
      result: simpleResult,
    }),
    addTypename: false,
  });
};

group((end) => {
  setup(() => {
    this.client = 18;
  });
  
  benchmark('constructing an instance', (done) => {
    new ApolloClient({});
    done();
  });
  end();
});

group((end) => {
  const client = getClientInstance();
  benchmark('fetching a query result from mocked server', (done) => {
    client.query({ query: simpleQuery }).then((result) => {
      done();
    });
  });
  end();
});

group((end) => {
  const client = getClientInstance();
  const myBenchmark = benchmark;
  client.query({ query: simpleQuery }).then(() => {
    myBenchmark('read + write simple query result in cache', (done) => {
      // read from the cache
      client.query({
        query: simpleQuery,
        noFetch: true,
      }).then((result) => {
        done();
      });
    });
    end();
  });
});

group((end) => {
  // TOOD need to figure out a way to run some code before
  // every call of this benchmark so that the client instance
  // and observable can be set up outside of the timed region.
  benchmark('write data and receive update from the cache', (done) => {
    const client = getClientInstance();
    const observable = client.watchQuery({
      query: simpleQuery,
      noFetch: true,
    });
    observable.subscribe({
      next(res: ApolloQueryResult<Object>) {
        if (Object.keys(res.data).length > 0) {
          done();
        }
      },
      error(err: Error) {
        console.warn('Error occurred in observable.');
      }
    });
    client.query({ query: simpleQuery });
  });
  
  end();
});

group((end) => {
  // This benchmark is supposed to check whether the time
  // taken to deliver updates is linear in subscribers or not.
  // (Should be linear).
  benchmark('write data and deliver update to 10 subscribers', (done) => {
    const promises: Promise<void>[] = [];
    const client = getClientInstance();

    times(10, () => {
      promises.push(new Promise<void>((resolve, reject) => {
        client.watchQuery({
          query: simpleQuery,
          noFetch: true,
        }).subscribe({
          next(res: ApolloQueryResult<Object>) {
            if (Object.keys(res.data).length > 0) {
              resolve();
            }
          }
        });
      }));
    });

    client.query({ query: simpleQuery });
    Promise.all(promises).then(() => {
      done();
    });
  });
  end();
});

Promise.all(groupPromises).then(() => {
  console.log('Running benchmarks.');
  bsuite
    .on('error', (error: any) => {
      console.log('Error: ', error);
    })
    .on('cycle', (event: any) => {
      console.log('Mean time in ms: ', event.target.stats.mean * 1000);
      console.log(String(event.target));
    })
    .run({'async': false});
});
