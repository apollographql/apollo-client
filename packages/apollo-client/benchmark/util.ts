import Benchmark from 'benchmark';

// This file implements utilities around benchmark.js that make it
// easier to use for our benchmarking needs.

// Specifically, it provides `group` and `benchmark`, examples of which
// can be seen within the benchmarks.The functions allow you to manage scope and async
// code more easily than benchmark.js typically allows.
//
// `group` is meant to provide a way to execute code that sets up the scope variables for your
// benchmark. It is only run once before the benchmark, not on every call of the code to
// be benchmarked. The `benchmark` function is similar to the `it` function within mocha;
// it allows you to define a particular block of code to be benchmarked.

Benchmark.options.minSamples = 150;
export const bsuite = new Benchmark.Suite();
export type DoneFunction = () => void;

export interface DescriptionObject {
  name: string;
  [other: string]: any;
}

export type Nullable<T> = T | undefined;
export type Description = DescriptionObject | string;
export type CycleFunction = (doneFn: DoneFunction) => void;
export type BenchmarkFunction = (
  description: Description,
  cycleFn: CycleFunction,
) => void;
export type GroupFunction = (done: DoneFunction) => void;
export type AfterEachCallbackFunction = (
  descr: Description,
  event: any,
) => void;
export type AfterEachFunction = (
  afterEachFnArg: AfterEachCallbackFunction,
) => void;
export type AfterAllCallbackFunction = () => void;
export type AfterAllFunction = (afterAllFn: AfterAllCallbackFunction) => void;

export let benchmark: BenchmarkFunction;
export let afterEach: AfterEachFunction;
export let afterAll: AfterAllFunction;

// Used to log stuff within benchmarks without pissing off tslint.
export function log(logString: string, ...args: any[]) {
  // tslint:disable-next-line
  console.log(logString, ...args);
}

// A reasonable implementation of dataIdFromObject that we use within
// the benchmarks.
export const dataIdFromObject = (object: any) => {
  if (object.__typename && object.id) {
    return object.__typename + '__' + object.id;
  }
  return null;
};

interface Scope {
  benchmark?: BenchmarkFunction;
  afterEach?: AfterEachFunction;
  afterAll?: AfterAllFunction;
}

// Internal function that returns the current exposed functions
// benchmark, setup, etc.
function currentScope() {
  return {
    benchmark,
    afterEach,
    afterAll,
  };
}

// Internal function that lets us set benchmark, setup, afterEach, etc.
// in a reasonable fashion.
function setScope(scope: Scope) {
  benchmark = scope.benchmark as BenchmarkFunction;
  afterEach = scope.afterEach as AfterEachFunction;
  afterAll = scope.afterAll as AfterAllFunction;
}

export const groupPromises: Promise<void>[] = [];

export const group = (groupFn: GroupFunction) => {
  const oldScope = currentScope();
  const scope: {
    benchmark?: BenchmarkFunction;
    afterEach?: AfterEachFunction;
    afterAll?: AfterAllFunction;
  } = {};

  let afterEachFn: Nullable<AfterEachCallbackFunction> = undefined;
  scope.afterEach = (afterEachFnArg: AfterEachCallbackFunction) => {
    afterEachFn = afterEachFnArg;
  };

  let afterAllFn: Nullable<AfterAllCallbackFunction> = undefined;
  scope.afterAll = (afterAllFnArg: AfterAllCallbackFunction) => {
    afterAllFn = afterAllFnArg;
  };

  const benchmarkPromises: Promise<void>[] = [];

  scope.benchmark = (
    description: string | Description,
    benchmarkFn: CycleFunction,
  ) => {
    const name =
      (description as DescriptionObject).name || (description as string);
    log('Adding benchmark: ', name);

    // const scopes: Object[] = [];
    let cycleCount = 0;
    benchmarkPromises.push(
      new Promise<void>((resolve, _) => {
        bsuite.add(name, {
          defer: true,
          fn: (deferred: any) => {
            const done = () => {
              cycleCount++;
              deferred.resolve();
            };

            benchmarkFn(done);
          },

          onComplete: (event: any) => {
            if (afterEachFn) {
              afterEachFn(description, event);
            }
            resolve();
          },
        });
      }),
    );
  };

  groupPromises.push(
    new Promise<void>((resolve, _) => {
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
    }),
  );
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
        log('');
      })
      .run({ async: false });
  });
}
