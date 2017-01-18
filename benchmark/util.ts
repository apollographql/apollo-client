import * as Benchmark from 'benchmark';

import {
  times,
  cloneDeep,
  merge,
} from 'lodash';

// This file implements utilities around benchmark.js that make it
// easier to use for our benchmarking needs.

// Specifically, it provides `group` and `benchmark`, examples of which
// can be seen within the benchmarks.The functions allow you to manage scope and async
// code more easily than benchmark.js typically allows.
//
// `group` is meant to provide a way to execute code that sets up the scope variables for your
// benchmark. It is only run once before the benchmark, not on every call of the code to
// be benchmarked.


// The maximum number of iterations that a benchmark can cycle for
// before it has to enter a setup loop again. This could probably be done through
// the Benchmark.count value but that doesn't seem to be exposed correctly
// to the setup function so we have to do this.
const MAX_ITERATIONS = 10000;
const bsuite = new Benchmark.Suite();


export type DoneFunction = () => void;
export type SetupScope = any;

export interface DescriptionObject {
  name: string;
  [other: string]: any;
};
export type Description = DescriptionObject | string;
export type CycleFunction = (doneFn: DoneFunction, setupScope?: SetupScope) => void;
export type BenchmarkFunction = (description: Description, cycleFn: CycleFunction) => void;
export type GroupFunction = (done: DoneFunction) => void;
export type SetupCycleFunction = () => void;
export type SetupFunction = (setupFn: SetupCycleFunction) => void;
export type AfterEachCallbackFunction = (descr: Description, event: any) => void;
export type AfterEachFunction = (afterEachFnArg: AfterEachCallbackFunction) => void;
export type AfterAllCallbackFunction = () => void;
export type AfterAllFunction = (afterAllFn: AfterAllCallbackFunction) => void;

export let benchmark: BenchmarkFunction = null;
export let setup: SetupFunction = null;
export let afterEach: AfterEachFunction = null;
export let afterAll: AfterAllFunction = null;

// Used to log stuff within benchmarks without pissing off tslint.
export function log(logString: string, ...args: any[]) {
  // tslint:disable-next-line
  console.log(logString, ...args);
}

interface Scope {
  benchmark?: BenchmarkFunction,
  setup?: SetupFunction,
  afterEach?: AfterEachFunction,
  afterAll?: AfterAllFunction,
};

// Internal function that returns the current exposed functions
// benchmark, setup, etc.
function currentScope() {
  return {
    benchmark,
    setup,
    afterEach,
    afterAll,
  };
}

// Internal function that lets us set benchmark, setup, afterEach, etc.
// in a reasonable fashion.
function setScope(scope: Scope) {
  benchmark = scope.benchmark;
  setup = scope.setup;
  afterEach = scope.afterEach;
  afterAll = scope.afterAll;
}

export const groupPromises: Promise<void>[] = [];

export const group = (groupFn: GroupFunction) => {
  const oldScope = currentScope();
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

    setScope(scope);
    groupFn(groupDone);
    setScope(oldScope);
    
  }));
};

export function runBenchmarks() {
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
}





