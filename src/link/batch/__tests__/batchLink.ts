import gql from "graphql-tag";
import { print } from "graphql";

import { ApolloLink, execute } from "../../core";
import { Operation, FetchResult, GraphQLRequest } from "../../core/types";
import { Observable } from "../../../utilities";
import { itAsync } from "../../../testing";
import {
  BatchLink,
  OperationBatcher,
  BatchHandler,
  BatchableRequest,
} from "../batchLink";

interface MockedResponse {
  request: GraphQLRequest;
  result?: FetchResult;
  error?: Error;
  delay?: number;
}

function getKey(operation: GraphQLRequest) {
  // XXX We're assuming here that query and variables will be serialized in
  // the same order, which might not always be true.
  const { query, variables, operationName } = operation;
  return JSON.stringify([operationName, query, variables]);
}

const delay = (time: number) => new Promise((r) => setTimeout(r, time));

function createOperation(starting: any, operation: GraphQLRequest): Operation {
  let context = { ...starting };
  const setContext = (next: any) => {
    if (typeof next === "function") {
      context = { ...context, ...next(context) };
    } else {
      context = { ...context, ...next };
    }
  };
  const getContext = () => ({ ...context });

  Object.defineProperty(operation, "setContext", {
    enumerable: false,
    value: setContext,
  });

  Object.defineProperty(operation, "getContext", {
    enumerable: false,
    value: getContext,
  });

  Object.defineProperty(operation, "toKey", {
    enumerable: false,
    value: () => getKey(operation),
  });

  return operation as Operation;
}

function terminatingCheck<TArgs extends any[]>(
  resolve: () => any,
  reject: (e: any) => any,
  callback: (...args: TArgs) => any
) {
  return function () {
    try {
      // @ts-expect-error
      callback.apply(this, arguments);
      resolve();
    } catch (error) {
      reject(error);
    }
  } as typeof callback;
}

function requestToKey(request: GraphQLRequest): string {
  const queryString =
    typeof request.query === "string" ? request.query : print(request.query);

  return JSON.stringify({
    variables: request.variables || {},
    query: queryString,
  });
}

function createMockBatchHandler(...mockedResponses: MockedResponse[]) {
  const mockedResponsesByKey: { [key: string]: MockedResponse[] } = {};

  const mockBatchHandler: BatchHandler = (operations: Operation[]) => {
    return new Observable((observer) => {
      const results = operations.map((operation) => {
        const key = requestToKey(operation);
        const responses = mockedResponsesByKey[key];
        if (!responses || responses.length === 0) {
          throw new Error(
            `No more mocked responses for the query: ${print(
              operation.query
            )}, variables: ${JSON.stringify(operation.variables)}`
          );
        }

        const { result, error } = responses.shift()!;

        if (!result && !error) {
          throw new Error(
            `Mocked response should contain either result or error: ${key}`
          );
        }

        if (error) {
          observer.error(error);
        }

        return result;
      }) as any;

      observer.next(results);
    });
  };

  (mockBatchHandler as any).addMockedResponse = (
    mockedResponse: MockedResponse
  ) => {
    const key = requestToKey(mockedResponse.request);
    let _mockedResponses = mockedResponsesByKey[key];
    if (!_mockedResponses) {
      _mockedResponses = [];
      mockedResponsesByKey[key] = _mockedResponses;
    }
    _mockedResponses.push(mockedResponse);
  };

  mockedResponses.map((mockBatchHandler as any).addMockedResponse);

  return mockBatchHandler;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("OperationBatcher", () => {
  it("should construct", () => {
    expect(() => {
      const querySched = new OperationBatcher({
        batchInterval: 10,
        batchHandler: () => null,
      });
      querySched.consumeQueue("");
    }).not.toThrow();
  });

  it("should not do anything when faced with an empty queue", () => {
    const batcher = new OperationBatcher({
      batchInterval: 10,
      batchHandler: () => null,
      batchKey: () => "yo",
    });

    expect(batcher["batchesByKey"].get("")).toBeUndefined();
    expect(batcher["batchesByKey"].get("yo")).toBeUndefined();
    batcher.consumeQueue();
    expect(batcher["batchesByKey"].get("")).toBeUndefined();
    expect(batcher["batchesByKey"].get("yo")).toBeUndefined();
  });

  it("should be able to add to the queue", () => {
    const batcher = new OperationBatcher({
      batchInterval: 10,
      batchHandler: () => null,
    });

    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;

    const request: BatchableRequest = {
      operation: createOperation({}, { query }),
    };

    expect(batcher["batchesByKey"].get("")).toBeUndefined();
    batcher.enqueueRequest(request).subscribe({});
    expect(batcher["batchesByKey"].get("")!.size).toBe(1);
    batcher.enqueueRequest(request).subscribe({});
    expect(batcher["batchesByKey"].get("")!.size).toBe(2);
  });

  describe("request queue", () => {
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const data = {
      author: {
        firstName: "John",
        lastName: "Smith",
      },
    };
    const batchHandler = createMockBatchHandler(
      {
        request: { query },
        result: { data },
      },
      {
        request: { query },
        result: { data },
      }
    );
    const operation: Operation = createOperation(
      {},
      {
        query,
      }
    );

    itAsync(
      "should be able to consume from a queue containing a single query",
      (resolve, reject) => {
        const myBatcher = new OperationBatcher({
          batchInterval: 10,
          batchHandler,
        });

        myBatcher.enqueueRequest({ operation }).subscribe(
          terminatingCheck(resolve, reject, (resultObj: any) => {
            expect(myBatcher["batchesByKey"].get("")).toBeUndefined();
            expect(resultObj).toEqual({ data });
          })
        );
        const observables: (Observable<FetchResult> | undefined)[] =
          myBatcher.consumeQueue()!;

        try {
          expect(observables.length).toBe(1);
        } catch (e) {
          reject(e);
        }
      }
    );

    itAsync(
      "should be able to consume from a queue containing multiple queries",
      (resolve, reject) => {
        const request2: Operation = createOperation(
          {},
          {
            query,
          }
        );

        const BH = createMockBatchHandler(
          {
            request: { query },
            result: { data },
          },
          {
            request: { query },
            result: { data },
          }
        );

        const myBatcher = new OperationBatcher({
          batchInterval: 10,
          batchMax: 10,
          batchHandler: BH,
        });
        const observable1 = myBatcher.enqueueRequest({ operation });
        const observable2 = myBatcher.enqueueRequest({ operation: request2 });
        let notify = false;
        observable1.subscribe((resultObj1) => {
          try {
            expect(resultObj1).toEqual({ data });
          } catch (e) {
            reject(e);
          }

          if (notify) {
            resolve();
          } else {
            notify = true;
          }
        });

        observable2.subscribe((resultObj2) => {
          try {
            expect(resultObj2).toEqual({ data });
          } catch (e) {
            reject(e);
          }

          if (notify) {
            resolve();
          } else {
            notify = true;
          }
        });

        try {
          expect(myBatcher["batchesByKey"].get("")!.size).toBe(2);
          const observables: (Observable<FetchResult> | undefined)[] =
            myBatcher.consumeQueue()!;
          expect(myBatcher["batchesByKey"].get("")).toBeUndefined();
          expect(observables.length).toBe(2);
        } catch (e) {
          reject(e);
        }
      }
    );

    itAsync(
      "should be able to consume from a queue containing multiple queries with different batch keys",
      (resolve, reject) => {
        // NOTE: this test was added to ensure that queries don't "hang" when consumed by BatchLink.
        // "Hanging" in this case results in this test never resolving.  So
        // if this test times out it's probably a real issue and not a flake
        const request2: Operation = createOperation(
          {},
          {
            query,
          }
        );

        const BH = createMockBatchHandler(
          {
            request: { query },
            result: { data },
          },
          {
            request: { query },
            result: { data },
          }
        );

        let key = true;
        const batchKey = () => {
          key = !key;
          return "" + !key;
        };

        const myBatcher = new OperationBatcher({
          batchInterval: 10,
          batchMax: 10,
          batchHandler: BH,
          batchKey,
        });

        const observable1 = myBatcher.enqueueRequest({ operation });
        const observable2 = myBatcher.enqueueRequest({ operation: request2 });

        let notify = false;
        observable1.subscribe((resultObj1) => {
          try {
            expect(resultObj1).toEqual({ data });
          } catch (e) {
            reject(e);
          }

          if (notify) {
            resolve();
          } else {
            notify = true;
          }
        });

        observable2.subscribe((resultObj2) => {
          try {
            expect(resultObj2).toEqual({ data });
          } catch (e) {
            reject(e);
          }

          if (notify) {
            resolve();
          } else {
            notify = true;
          }
        });

        jest.runAllTimers();
      }
    );

    itAsync(
      "should return a promise when we enqueue a request and resolve it with a result",
      (resolve, reject) => {
        const BH = createMockBatchHandler({
          request: { query },
          result: { data },
        });
        const myBatcher = new OperationBatcher({
          batchInterval: 10,
          batchHandler: BH,
        });
        const observable = myBatcher.enqueueRequest({ operation });
        observable.subscribe(
          terminatingCheck(resolve, reject, (result: any) => {
            expect(result).toEqual({ data });
          })
        );
        myBatcher.consumeQueue();
      }
    );

    itAsync("should be able to debounce requests", (resolve, reject) => {
      const batchInterval = 10;
      const myBatcher = new OperationBatcher({
        batchDebounce: true,
        batchInterval,
        batchHandler,
      });

      // 1. Queue up 3 requests
      myBatcher.enqueueRequest({ operation }).subscribe({});
      myBatcher.enqueueRequest({ operation }).subscribe({});
      myBatcher.enqueueRequest({ operation }).subscribe({});
      expect(myBatcher["batchesByKey"].get("")!.size).toEqual(3);

      // 2. Run the timer halfway.
      jest.advanceTimersByTime(batchInterval / 2);
      expect(myBatcher["batchesByKey"].get("")!.size).toEqual(3);

      // 3. Queue a 4th request, causing the timer to reset.
      myBatcher.enqueueRequest({ operation }).subscribe({});
      expect(myBatcher["batchesByKey"].get("")!.size).toEqual(4);

      // 4. Run the timer to batchInterval + 1, at this point, if debounce were
      // not set, the original 3 requests would have fired, but we expect
      // instead that the queries will instead fire at
      // (batchInterval + batchInterval / 2).
      jest.advanceTimersByTime(batchInterval / 2 + 1);
      expect(myBatcher["batchesByKey"].get("")!.size).toEqual(4);

      // 5. Finally, run the timer to (batchInterval + batchInterval / 2) +1,
      // and expect the queue to be empty.
      jest.advanceTimersByTime(batchInterval / 2);
      expect(myBatcher["batchesByKey"].size).toEqual(0);
      resolve();
    });
  });

  itAsync("should work when single query", (resolve, reject) => {
    const data = {
      lastName: "Ever",
      firstName: "Greatest",
    };
    const batcher = new OperationBatcher({
      batchInterval: 10,
      batchHandler: () =>
        new Observable((observer) => {
          observer.next([{ data }]);
          setTimeout(observer.complete.bind(observer));
        }),
    });
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const operation: Operation = createOperation({}, { query });

    batcher.enqueueRequest({ operation }).subscribe({});
    try {
      expect(batcher["batchesByKey"].get("")!.size).toBe(1);
    } catch (e) {
      reject(e);
    }

    setTimeout(
      terminatingCheck(resolve, reject, () => {
        expect(batcher["batchesByKey"].get("")).toBeUndefined();
      }),
      20
    );

    jest.runAllTimers();
  });

  itAsync(
    "should cancel single query in queue when unsubscribing",
    (resolve, reject) => {
      const data = {
        lastName: "Ever",
        firstName: "Greatest",
      };

      const batcher = new OperationBatcher({
        batchInterval: 10,
        batchHandler: () =>
          new Observable((observer) => {
            observer.next([{ data }]);
            setTimeout(observer.complete.bind(observer));
          }),
      });

      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      batcher
        .enqueueRequest({
          operation: createOperation({}, { query }),
        })
        .subscribe(() => reject("next should never be called"))
        .unsubscribe();

      expect(batcher["batchesByKey"].get("")).toBeUndefined();
      resolve();
    }
  );

  itAsync(
    "should cancel single query in queue with multiple subscriptions",
    (resolve, reject) => {
      const data = {
        lastName: "Ever",
        firstName: "Greatest",
      };
      const batcher = new OperationBatcher({
        batchInterval: 10,
        batchHandler: () =>
          new Observable((observer) => {
            observer.next([{ data }]);
            setTimeout(observer.complete.bind(observer));
          }),
      });
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const operation: Operation = createOperation({}, { query });

      const observable = batcher.enqueueRequest({ operation });

      const checkQueuedRequests = (expectedSubscriberCount: number) => {
        const batch = batcher["batchesByKey"].get("");
        expect(batch).not.toBeUndefined();
        expect(batch!.size).toBe(1);
        batch!.forEach((request) => {
          expect(request.subscribers.size).toBe(expectedSubscriberCount);
        });
      };

      const sub1 = observable.subscribe(() =>
        reject("next should never be called")
      );
      checkQueuedRequests(1);

      const sub2 = observable.subscribe(() =>
        reject("next should never be called")
      );
      checkQueuedRequests(2);

      sub1.unsubscribe();
      checkQueuedRequests(1);

      sub2.unsubscribe();
      expect(batcher["batchesByKey"].get("")).toBeUndefined();
      resolve();
    }
  );

  itAsync(
    "should cancel single query in flight when unsubscribing",
    (resolve, reject) => {
      const batcher = new OperationBatcher({
        batchInterval: 10,
        batchHandler: () =>
          new Observable(() => {
            // Instead of typically starting an XHR, we trigger the unsubscription from outside
            setTimeout(() => subscription?.unsubscribe(), 5);

            return () => {
              expect(batcher["batchesByKey"].get("")).toBeUndefined();
              resolve();
            };
          }),
      });

      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const subscription = batcher
        .enqueueRequest({
          operation: createOperation({}, { query }),
        })
        .subscribe(() => reject("next should never be called"));

      jest.runAllTimers();
    }
  );

  itAsync("should correctly batch multiple queries", (resolve, reject) => {
    const data = {
      lastName: "Ever",
      firstName: "Greatest",
    };
    const data2 = {
      lastName: "Hauser",
      firstName: "Evans",
    };
    const batcher = new OperationBatcher({
      batchInterval: 10,
      batchHandler: () =>
        new Observable((observer) => {
          observer.next([{ data }, { data: data2 }, { data }]);
          setTimeout(observer.complete.bind(observer));
        }),
    });
    const query = gql`
      query {
        author {
          firstName
          lastName
        }
      }
    `;
    const operation: Operation = createOperation({}, { query });
    const operation2: Operation = createOperation({}, { query });
    const operation3: Operation = createOperation({}, { query });

    batcher.enqueueRequest({ operation }).subscribe({});
    batcher.enqueueRequest({ operation: operation2 }).subscribe({});
    try {
      expect(batcher["batchesByKey"].get("")!.size).toBe(2);
    } catch (e) {
      reject(e);
    }

    setTimeout(() => {
      // The batch shouldn't be fired yet, so we can add one more request.
      batcher.enqueueRequest({ operation: operation3 }).subscribe({});
      try {
        expect(batcher["batchesByKey"].get("")!.size).toBe(3);
      } catch (e) {
        reject(e);
      }
    }, 5);

    setTimeout(
      terminatingCheck(resolve, reject, () => {
        // The batch should've been fired by now.
        expect(batcher["batchesByKey"].get("")).toBeUndefined();
      }),
      20
    );

    jest.runAllTimers();
  });

  itAsync(
    "should cancel multiple queries in queue when unsubscribing and let pass still subscribed one",
    (resolve, reject) => {
      const data2 = {
        lastName: "Hauser",
        firstName: "Evans",
      };

      const batcher = new OperationBatcher({
        batchInterval: 10,
        batchHandler: () =>
          new Observable((observer) => {
            observer.next([{ data: data2 }]);
            setTimeout(observer.complete.bind(observer));
          }),
      });

      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;

      const operation: Operation = createOperation({}, { query });
      const operation2: Operation = createOperation({}, { query });
      const operation3: Operation = createOperation({}, { query });

      const sub1 = batcher
        .enqueueRequest({ operation })
        .subscribe(() => reject("next should never be called"));
      batcher.enqueueRequest({ operation: operation2 }).subscribe((result) => {
        expect(result.data).toBe(data2);

        // The batch should've been fired by now.
        expect(batcher["batchesByKey"].get("")).toBeUndefined();

        resolve();
      });

      expect(batcher["batchesByKey"].get("")!.size).toBe(2);

      sub1.unsubscribe();
      expect(batcher["batchesByKey"].get("")!.size).toBe(1);

      setTimeout(() => {
        // The batch shouldn't be fired yet, so we can add one more request.
        const sub3 = batcher
          .enqueueRequest({ operation: operation3 })
          .subscribe(() => reject("next should never be called"));
        expect(batcher["batchesByKey"].get("")!.size).toBe(2);

        sub3.unsubscribe();
        expect(batcher["batchesByKey"].get("")!.size).toBe(1);
      }, 5);

      jest.runAllTimers();
    }
  );

  itAsync(
    "should reject the promise if there is a network error",
    (resolve, reject) => {
      const query = gql`
        query {
          author {
            firstName
            lastName
          }
        }
      `;
      const operation: Operation = createOperation({}, { query });
      const error = new Error("Network error");
      const BH = createMockBatchHandler({
        request: { query },
        error,
      });
      const batcher = new OperationBatcher({
        batchInterval: 10,
        batchHandler: BH,
      });

      const observable = batcher.enqueueRequest({ operation });
      observable.subscribe({
        error: terminatingCheck(resolve, reject, (resError: Error) => {
          expect(resError.message).toBe("Network error");
        }),
      });
      batcher.consumeQueue();
    }
  );
});

describe("BatchLink", () => {
  const query = gql`
    {
      id
    }
  `;

  it("does not need any constructor arguments", () => {
    expect(
      () => new BatchLink({ batchHandler: () => Observable.of() })
    ).not.toThrow();
  });

  itAsync("passes forward on", (resolve, reject) => {
    const link = ApolloLink.from([
      new BatchLink({
        batchInterval: 0,
        batchMax: 1,
        batchHandler: (operation, forward) => {
          try {
            expect(forward!.length).toBe(1);
            expect(operation.length).toBe(1);
          } catch (e) {
            reject(e);
          }
          return forward![0]!(operation[0]).map((result) => [result]);
        },
      }),
      new ApolloLink((operation) => {
        terminatingCheck(resolve, reject, () => {
          expect(operation.query).toEqual(query);
        })();
        return null;
      }),
    ]);

    execute(
      link,
      createOperation(
        {},
        {
          query,
        }
      )
    ).subscribe((result) => reject());
  });

  it("raises warning if terminating", () => {
    let calls = 0;
    const link_full = new BatchLink({
      batchHandler: (operation, forward) =>
        forward![0]!(operation[0]).map((r) => [r]),
    });
    const link_one_op = new BatchLink({
      batchHandler: (operation) => Observable.of(),
    });
    const link_no_op = new BatchLink({ batchHandler: () => Observable.of() });
    const _warn = console.warn;
    console.warn = (...args: any) => {
      calls++;
      expect(args).toEqual([
        "You are calling concat on a terminating link, which will have no effect %o",
        expect.any(BatchLink),
      ]);
    };
    expect(
      link_one_op.concat((operation, forward) => forward(operation))
    ).toEqual(link_one_op);
    expect(
      link_no_op.concat((operation, forward) => forward(operation))
    ).toEqual(link_no_op);
    console.warn = (warning: any) => {
      throw Error("non-terminating link should not throw");
    };
    expect(
      link_full.concat((operation, forward) => forward(operation))
    ).not.toEqual(link_full);
    console.warn = _warn;
    expect(calls).toBe(2);
  });

  itAsync("correctly uses batch size", (resolve, reject) => {
    const sizes = [1, 2, 3];
    const terminating = new ApolloLink((operation) => {
      try {
        expect(operation.query).toEqual(query);
      } catch (e) {
        reject(e);
      }
      return Observable.of(operation.variables.count);
    });

    let runBatchSize = () => {
      const size = sizes.pop();
      if (!size) resolve();

      const batchHandler = jest.fn((operation, forward) => {
        try {
          expect(operation.length).toBe(size);
          expect(forward.length).toBe(size);
        } catch (e) {
          reject(e);
        }
        const observables = forward.map((f: any, i: any) => f(operation[i]));
        return new Observable((observer) => {
          const data: any[] = [];
          observables.forEach((obs: any) =>
            obs.subscribe((d: any) => {
              data.push(d);
              if (data.length === observables.length) {
                observer.next(data);
                observer.complete();
              }
            })
          );
        });
      }) as any;

      const link = ApolloLink.from([
        new BatchLink({
          batchInterval: 1000,
          batchMax: size,
          batchHandler,
        }),
        terminating,
      ]);

      Array.from(new Array(size)).forEach((_, i) => {
        execute(link, {
          query,
          variables: { count: i },
        }).subscribe({
          next: (data) => {
            expect(data).toBe(i);
          },
          complete: () => {
            try {
              expect(batchHandler.mock.calls.length).toBe(1);
            } catch (e) {
              reject(e);
            }
            runBatchSize();
          },
        });
      });
    };

    runBatchSize();
  });

  itAsync("correctly follows batch interval", (resolve, reject) => {
    const intervals = [10, 20, 30];

    const runBatchInterval = () => {
      const mock = jest.fn();

      const batchInterval = intervals.pop();
      if (!batchInterval) return resolve();

      const batchHandler = jest.fn((operation, forward) => {
        try {
          expect(operation.length).toBe(1);
          expect(forward.length).toBe(1);
        } catch (e) {
          reject(e);
        }

        return forward[0](operation[0]).map((d: any) => [d]);
      });

      const link = ApolloLink.from([
        new BatchLink({
          batchInterval,
          batchMax: 0,
          batchHandler,
        }),
        () => Observable.of(42) as any,
      ]);

      execute(
        link,
        createOperation(
          {},
          {
            query,
          }
        )
      ).subscribe({
        next: (data) => {
          try {
            expect(data).toBe(42);
          } catch (e) {
            reject(e);
          }
        },
        complete: () => {
          mock(batchHandler.mock.calls.length);
        },
      });

      const delayedBatchInterval = async () => {
        await delay(batchInterval);

        const checkCalls = mock.mock.calls.slice(0, -1);
        try {
          expect(checkCalls.length).toBe(2);
          checkCalls.forEach((args) => expect(args[0]).toBe(0));
          expect(mock).lastCalledWith(1);
          expect(batchHandler.mock.calls.length).toBe(1);
        } catch (e) {
          reject(e);
        }

        runBatchInterval();
      };

      delayedBatchInterval();

      mock(batchHandler.mock.calls.length);
      mock(batchHandler.mock.calls.length);

      jest.runOnlyPendingTimers();
    };
    runBatchInterval();
  });

  itAsync(
    "throws an error when more requests than results",
    (resolve, reject) => {
      const result = [{ data: {} }];
      const batchHandler = jest.fn((op) => Observable.of(result));

      const link = ApolloLink.from([
        new BatchLink({
          batchInterval: 10,
          batchMax: 2,
          batchHandler,
        }),
      ]);

      [1, 2].forEach((x) => {
        execute(link, {
          query,
        }).subscribe({
          next: (data) => {
            reject("next should not be called");
          },
          error: terminatingCheck(resolve, reject, (error: any) => {
            expect(error).toBeDefined();
            expect(error.result).toEqual(result);
          }),
          complete: () => {
            reject("complete should not be called");
          },
        });
      });
    }
  );

  describe("batchKey", () => {
    itAsync(
      "should allow different batches to be created separately",
      (resolve, reject) => {
        const data = { data: {} };
        const result = [data, data];

        const batchHandler = jest.fn((op) => {
          try {
            expect(op.length).toBe(2);
          } catch (e) {
            reject(e);
          }
          return Observable.of(result);
        });
        let key = true;
        const batchKey = () => {
          key = !key;
          return "" + !key;
        };

        const link = ApolloLink.from([
          new BatchLink({
            batchInterval: 1,
            //if batchKey does not work, then the batch size would be 3
            batchMax: 2,
            batchHandler,
            batchKey,
          }),
        ]);

        let count = 0;
        [1, 2, 3, 4].forEach(() => {
          execute(link, {
            query,
          }).subscribe({
            next: (d) => {
              try {
                expect(d).toEqual(data);
              } catch (e) {
                reject(e);
              }
            },
            error: reject,
            complete: () => {
              count++;
              if (count === 4) {
                try {
                  expect(batchHandler.mock.calls.length).toBe(2);
                  resolve();
                } catch (e) {
                  reject(e);
                }
              }
            },
          });
        });
      }
    );
  });
});
