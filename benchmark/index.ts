import gql from 'graphql-tag';

import {
  ApolloClient,
  ApolloQueryResult,
  ObservableQuery,
} from '../src/index';

import mockNetworkInterface from '../test/mocks/mockNetworkInterface';

import {
  Deferred,
} from 'benchmark';

import {
  times,
  cloneDeep,
  merge,
} from 'lodash';

import * as Benchmark from 'benchmark';

// The maximum number of iterations that a benchmark can cycle for
// before it has to enter a setup loop again. This could probably be done through
// the Benchmark.count value but that doesn't seem to be exposed correctly
// to the setup function so we have to do this.
const MAX_ITERATIONS = 10000;
const bsuite = new Benchmark.Suite();

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
type SetupScope = any;

interface DescriptionObject {
  name: string;
  [other: string]: any;
};
type Description = DescriptionObject | string;
type CycleFunction = (doneFn: DoneFunction, setupScope?: SetupScope) => void;
type BenchmarkFunction = (description: Description, cycleFn: CycleFunction) => void;
type GroupFunction = (done: DoneFunction) => void;
type SetupCycleFunction = () => void;
type SetupFunction = (setupFn: SetupCycleFunction) => void;
type AfterEachCallbackFunction = (descr: Description, event: any) => void;
type AfterEachFunction = (afterEachFnArg: AfterEachCallbackFunction) => void;
type AfterAllCallbackFunction = () => void;
type AfterAllFunction = (afterAllFn: AfterAllCallbackFunction) => void;

let benchmark: BenchmarkFunction = null;
let setup: SetupFunction = null;
let afterEach: AfterEachFunction = null;
let afterAll: AfterAllFunction = null;

const log = (logString: string, ...args: any[]) => {
  // tslint:disable-next-line
  console.log(logString, ...args);
};

const groupPromises: Promise<void>[] = [];
const group = (groupFn: GroupFunction) => {
  const oldBenchmark = benchmark;
  const oldSetup = setup;
  const oldAfterEach = afterEach;
  const oldAfterAll = afterAll;

  const scope: {
    setup?: SetupFunction,
    benchmark?: BenchmarkFunction,
    afterEach?: AfterEachFunction,
    afterAll?: AfterAllFunction,
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
  // Note that you should not use this if your pre-benchmark setup consumes a "large"
  // chunk of memory (for some defn. of large). This leads to a segfault in V8.
  //
  // This makes it possible to write code in the `SetupCycleFunction`
  // almost as if it is run before every of the `CycleFunction`. Check in the benchmarks
  // themselves for an example of this.
  let setupFn: SetupCycleFunction = null;
  scope.setup = (setupFnArg: SetupCycleFunction) => {
    setupFn = setupFnArg;
  };

  let afterEachFn: AfterEachCallbackFunction = null;
  scope.afterEach = (afterEachFnArg: AfterAllCallbackFunction) => {
    afterEachFn = afterEachFnArg;
  };

  let afterAllFn: AfterAllCallbackFunction = null;
  scope.afterAll = (afterAllFnArg: AfterAllCallbackFunction) => {
    afterAllFn = afterAllFnArg;
  };

  const benchmarkPromises: Promise<void>[] = [];

  scope.benchmark = (description: string | Description, benchmarkFn: CycleFunction) => {
    const name = (description as DescriptionObject).name || (description as string);
    log('Adding benchmark: ', name);

    const scopes: Object[] = [];
    let cycleCount = 0;
    const runSetup = () => {
      const originalThis = this;
      times(MAX_ITERATIONS, () => {
        setupFn.apply(this);
        scopes.push(cloneDeep(this));
      });

      cycleCount = 0;
    };

    benchmarkPromises.push(new Promise<void>((resolve, reject) => {
      bsuite.add(name, {
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
            cycleCount++;
            deferred.resolve();
          };

          const passingScope = merge({}, this, scopes[cycleCount]) as SetupScope;
          benchmarkFn(done, passingScope);
        },

        onComplete: (event: any) => {
          if (afterEachFn) {
            afterEachFn(description, event);
          }
          resolve();
        },
      });
    }));
  };


  groupPromises.push(new Promise<void>((resolve, reject) => {
    const groupDone = () => {
      Promise.all(benchmarkPromises).then(() => {
        if (afterAllFn) {
          afterAllFn();
        }
      });
      resolve();
    };

    benchmark = scope.benchmark;
    setup = scope.setup;
    afterEach = scope.afterEach;
    afterAll = scope.afterAll;

    groupFn(groupDone);

    benchmark = oldBenchmark;
    setup = oldSetup;
    afterEach = oldAfterEach;
    afterAll = oldAfterAll;
  }));
};


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
  benchmark('constructing an instance', (done) => {
    new ApolloClient({});
    done();
  });
  end();
});

group((end) => {
  benchmark('fetching a query result from mocked server', (done, setupScope) => {
    const client = getClientInstance();
    client.query({ query: simpleQuery }).then((result) => {
      done();
    });
  });

  end();
});

/*
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
}); */

group((end) => {
  // TOOD need to figure out a way to run some code before
  // every call of this benchmark so that the client instance
  // and observable can be set up outside of the timed region.
  benchmark('write data and receive update from the cache', (done, setupScope) => {
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
      },
    });
    client.query({ query: simpleQuery });
  });

  end();
});

group((end) => {
  // This benchmark is supposed to check whether the time
  // taken to deliver updates is linear in subscribers or not.
  // (Should be linear).
  const meanTimes: { [subscriberCount: string]: number } = {};

  times(50, (countR) => {
    const count = countR * 5;
    benchmark({
      name: `write data and deliver update to ${count} subscribers`,
      count,
    }, (done) => {
      const promises: Promise<void>[] = [];
      const client = getClientInstance();

      times(count, () => {
        promises.push(new Promise<void>((resolve, reject) => {
          client.watchQuery({
            query: simpleQuery,
            noFetch: true,
          }).subscribe({
            next(res: ApolloQueryResult<Object>) {
              if (Object.keys(res.data).length > 0) {
                resolve();
              }
            },
          });
        }));
      });

      client.query({ query: simpleQuery });
      Promise.all(promises).then(() => {
        done();
      });
    });

    afterEach((description: DescriptionObject, event: any) => {
      const iterCount = description['count'] as number;
      meanTimes[iterCount.toString()] = event.target.stats.mean * 1000;
    });
  });

  afterAll(() => {
    log('Mean times: ');
    Object.keys(meanTimes).forEach((key) => {
      log('%s, %d', key, meanTimes[key]);
    });
  });
  end();
});

Promise.all(groupPromises).then(() => {
  log('Running benchmarks.');
  bsuite
    .on('error', (error: any) => {
      log('Error: ', error);
    })
    .on('cycle', (event: any) => {
      log('Mean time in ms: ', event.target.stats.mean * 1000);
      log(String(event.target));
    })
    .run({'async': false});
});
