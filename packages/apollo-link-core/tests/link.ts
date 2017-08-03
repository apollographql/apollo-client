import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import { execute, ApolloLink } from '../src/link';
import Observable from 'zen-observable-ts';
import { MockLink, SetContextLink } from '../src/test-utils';
import gql from 'graphql-tag';
import { FetchResult, Operation, NextLink } from '../src/types';

import { testLinkResults } from '../src/test-utils';

const sampleQuery = `query SampleQuery{
  stub{
    id
  }
}`;

describe('ApolloLink(abstract class)', () => {
  const setContext = () => ({ add: 1 });

  describe('concat', () => {
    it('should concat a function', done => {
      const returnOne = new SetContextLink(setContext);
      const link = returnOne.concat((operation, forward) =>
        Observable.of({ data: { count: operation.context.add } }),
      );

      testLinkResults({
        link,
        results: [{ count: 1 }],
        done,
      });
    });

    it('should concat a Link', done => {
      const returnOne = new SetContextLink(setContext);
      const mock = new MockLink(op => Observable.of({ data: op.context.add }));
      const link = returnOne.concat(mock);

      testLinkResults({
        link,
        results: [1],
        done,
      });
    });

    it("should pass error to observable's error", done => {
      const error = new Error('thrown');
      const returnOne = new SetContextLink(setContext);
      const mock = new MockLink(
        op =>
          new Observable(observer => {
            observer.next({ data: op.context.add });
            observer.error(error);
          }),
      );
      const link = returnOne.concat(mock);

      testLinkResults({
        link,
        results: [1, error],
        done,
      });
    });

    it('should concat a Link and function', done => {
      const returnOne = new SetContextLink(setContext);
      const mock = new MockLink((op, forward) => {
        let _op = {
          ...op,
          context: {
            add: op.context.add + 2,
          },
        };
        return forward(_op);
      });
      const link = returnOne.concat(mock).concat(op => {
        return Observable.of({ data: op.context.add });
      });

      testLinkResults({
        link,
        results: [3],
        done,
      });
    });

    it('should concat a function and Link', done => {
      const returnOne = new SetContextLink(setContext);
      const mock = new MockLink((op, forward) =>
        Observable.of({ data: op.context.add }),
      );

      const link = returnOne
        .concat((operation, forward) => {
          operation = {
            ...operation,
            context: {
              add: operation.context.add + 2,
            },
          };
          return forward(operation);
        })
        .concat(mock);
      testLinkResults({
        link,
        results: [3],
        done,
      });
    });

    it('should concat two functions', done => {
      const returnOne = new SetContextLink(setContext);
      const link = returnOne
        .concat((operation, forward) => {
          operation = {
            ...operation,
            context: {
              add: operation.context.add + 2,
            },
          };
          return forward(operation);
        })
        .concat((op, forward) => Observable.of({ data: op.context.add }));
      testLinkResults({
        link,
        results: [3],
        done,
      });
    });

    it('should concat two Links', done => {
      const returnOne = new SetContextLink(setContext);
      const mock1 = new MockLink((operation, forward) => {
        operation = {
          ...operation,
          context: {
            add: operation.context.add + 2,
          },
        };
        return forward(operation);
      });
      const mock2 = new MockLink((op, forward) =>
        Observable.of({ data: op.context.add }),
      );

      const link = returnOne.concat(mock1).concat(mock2);
      testLinkResults({
        link,
        results: [3],
        done,
      });
    });

    it("should return an link that can be concat'd multiple times", done => {
      const returnOne = new SetContextLink(setContext);
      const mock1 = new MockLink((operation, forward) => {
        operation = {
          ...operation,
          context: {
            add: operation.context.add + 2,
          },
        };
        return forward(operation);
      });
      const mock2 = new MockLink((op, forward) =>
        Observable.of({ data: op.context.add + 2 }),
      );
      const mock3 = new MockLink((op, forward) =>
        Observable.of({ data: op.context.add + 3 }),
      );
      const link = returnOne.concat(mock1);

      testLinkResults({
        link: link.concat(mock2),
        results: [5],
      });
      testLinkResults({
        link: link.concat(mock3),
        results: [6],
        done,
      });
    });
  });

  describe('split', () => {
    it('should split two functions', done => {
      const context = { add: 1 };
      const returnOne = new SetContextLink(() => context);
      const link1 = returnOne.concat((operation, forward) =>
        Observable.of({ data: operation.context.add + 1 }),
      );
      const link2 = returnOne.concat((operation, forward) =>
        Observable.of({ data: operation.context.add + 2 }),
      );
      const link = returnOne.split(
        operation => operation.context.add === 1,
        link1,
        link2,
      );

      testLinkResults({
        link,
        results: [2],
      });

      context.add = 2;

      testLinkResults({
        link,
        results: [4],
        done,
      });
    });

    it('should split two Links', done => {
      const context = { add: 1 };
      const returnOne = new SetContextLink(() => context);
      const link1 = returnOne.concat(
        new MockLink((operation, forward) =>
          Observable.of({ data: operation.context.add + 1 }),
        ),
      );
      const link2 = returnOne.concat(
        new MockLink((operation, forward) =>
          Observable.of({ data: operation.context.add + 2 }),
        ),
      );
      const link = returnOne.split(
        operation => operation.context.add === 1,
        link1,
        link2,
      );

      testLinkResults({
        link,
        results: [2],
      });

      context.add = 2;

      testLinkResults({
        link,
        results: [4],
        done,
      });
    });

    it('should split a link and a function', done => {
      const context = { add: 1 };
      const returnOne = new SetContextLink(() => context);
      const link1 = returnOne.concat((operation, forward) =>
        Observable.of({ data: operation.context.add + 1 }),
      );
      const link2 = returnOne.concat(
        new MockLink((operation, forward) =>
          Observable.of({ data: operation.context.add + 2 }),
        ),
      );
      const link = returnOne.split(
        operation => operation.context.add === 1,
        link1,
        link2,
      );

      testLinkResults({
        link,
        results: [2],
      });

      context.add = 2;

      testLinkResults({
        link,
        results: [4],
        done,
      });
    });

    it('should allow concat after split to be join', done => {
      const context = { test: true, add: 1 };
      const start = new SetContextLink(() => ({ ...context }));
      const link = start
        .split(
          operation => operation.context.test,
          (operation, forward) => {
            operation.context.add++;
            return forward(operation);
          },
          (operation, forward) => {
            operation.context.add += 2;
            return forward(operation);
          },
        )
        .concat(operation => Observable.of({ data: operation.context.add }));

      testLinkResults({
        link,
        context,
        results: [2],
      });

      context.test = false;

      testLinkResults({
        link,
        context,
        results: [3],
        done,
      });
    });

    it('should allow default right to be empty or passthrough when forward available', done => {
      let context = { test: true };
      const start = new SetContextLink(() => context);
      const link = start.split(
        operation => operation.context.test,
        operation =>
          Observable.of({
            data: {
              count: 1,
            },
          }),
      );
      const concat = link.concat(operation =>
        Observable.of({
          data: {
            count: 2,
          },
        }),
      );

      testLinkResults({
        link,
        results: [{ count: 1 }],
      });

      context.test = false;

      testLinkResults({
        link,
        results: [],
      });

      testLinkResults({
        link: concat,
        results: [{ count: 2 }],
        done,
      });
    });
  });

  describe('empty', () => {
    it('should returns an immediately completed Observable', done => {
      testLinkResults({
        link: ApolloLink.empty(),
        done,
      });
    });
  });
});

describe('Link static library', () => {
  describe('from', () => {
    const uniqueOperation: Operation = {
      query: gql(sampleQuery),
      context: { name: 'uniqueName' },
      operationName: 'sampleQuery',
    };

    it('should create an observable that completes when passed an empty array', done => {
      const observable = execute(ApolloLink.from([]), {
        query: gql(sampleQuery),
      });
      observable.subscribe(
        () => assert(false, 'should not call next'),
        () => assert(false, 'should not call error'),
        done,
      );
    });

    it('can create chain of one', () => {
      assert.doesNotThrow(() => ApolloLink.from([new MockLink()]));
    });

    it('can create chain of two', () => {
      assert.doesNotThrow(() =>
        ApolloLink.from([
          new MockLink((operation, forward) => forward(operation)),
          new MockLink(),
        ]),
      );
    });

    it('should receive result of one link', done => {
      const data: FetchResult = {
        data: {
          hello: 'world',
        },
      };
      const chain = ApolloLink.from([new MockLink(() => Observable.of(data))]);
      const observable = execute(chain, uniqueOperation);
      observable.subscribe({
        next: actualData => {
          assert.deepEqual(data, actualData);
        },
        error: () => expect.fail(),
        complete: () => done(),
      });
    });

    it('should accept sting query and pass AST to link', done => {
      const astOperation = {
        ...uniqueOperation,
        query: gql(sampleQuery),
      };

      const operation = {
        ...uniqueOperation,
        query: sampleQuery,
      };

      const stub = sinon.stub().withArgs(astOperation).callsFake(op => {
        assert.deepEqual({ ...astOperation, variables: {} }, op);
        done();
      });

      const chain = ApolloLink.from([new MockLink(stub)]);
      execute(chain, operation);
    });

    it('should accept AST query and pass AST to link', done => {
      const astOperation = {
        ...uniqueOperation,
        query: gql(sampleQuery),
      };

      const stub = sinon.stub().withArgs(astOperation).callsFake(op => {
        assert.deepEqual({ ...astOperation, variables: {} }, op);
        done();
      });

      const chain = ApolloLink.from([new MockLink(stub)]);
      execute(chain, astOperation);
    });

    it('should pass operation from one link to next with modifications', done => {
      const chain = ApolloLink.from([
        new MockLink((op, forward) =>
          forward({
            ...op,
            query: gql(sampleQuery),
          }),
        ),
        new MockLink(op => {
          assert.deepEqual(
            <Operation>{
              ...uniqueOperation,
              query: gql(sampleQuery),
              variables: {},
            },
            op,
          );
          return done();
        }),
      ]);
      execute(chain, uniqueOperation);
    });

    it('should pass result of one link to another with forward', done => {
      const data: FetchResult = {
        data: {
          hello: 'world',
        },
      };

      const chain = ApolloLink.from([
        new MockLink((op, forward) => {
          const observable = forward(op);

          observable.subscribe({
            next: actualData => {
              assert.deepEqual(data, actualData);
            },
            error: expect.fail,
            complete: done,
          });

          return observable;
        }),
        new MockLink(() => Observable.of(data)),
      ]);
      execute(chain, uniqueOperation);
    });

    it('should receive final result of two link chain', done => {
      const data: FetchResult = {
        data: {
          hello: 'world',
        },
      };

      const chain = ApolloLink.from([
        new MockLink((op, forward) => {
          const observable = forward(op);

          return new Observable(observer => {
            observable.subscribe({
              next: actualData => {
                assert.deepEqual(data, actualData);
                observer.next({
                  data: {
                    ...actualData.data,
                    modification: 'unique',
                  },
                });
              },
              error: error => observer.error(error),
              complete: () => observer.complete(),
            });
          });
        }),
        new MockLink(() => Observable.of(data)),
      ]);

      const result = execute(chain, uniqueOperation);

      result.subscribe({
        next: modifiedData => {
          assert.deepEqual(
            {
              data: {
                ...data.data,
                modification: 'unique',
              },
            },
            modifiedData,
          );
        },
        error: expect.fail,
        complete: done,
      });
    });

    it('should chain together a function with links', done => {
      const add1 = (operation: Operation, forward: NextLink) => {
        operation.context.num++;
        return forward(operation);
      };
      const add1Link = new MockLink((operation, forward) => {
        operation.context.num++;
        return forward(operation);
      });

      const link = ApolloLink.from([
        add1,
        add1,
        add1Link,
        add1,
        add1Link,
        operation => Observable.of({ data: operation.context }),
      ]);
      testLinkResults({
        link,
        results: [{ num: 5 }],
        context: { num: 0 },
        done,
      });
    });
  });

  describe('split', () => {
    it('should create filter when single link passed in', done => {
      const link = ApolloLink.split(
        operation => operation.context.test,
        (operation, forward) => Observable.of({ data: { count: 1 } }),
      );

      let context = { test: true };

      testLinkResults({
        link,
        results: [{ count: 1 }],
        context,
      });

      context.test = false;

      testLinkResults({
        link,
        results: [],
        context,
        done,
      });
    });

    it('should split two functions', done => {
      const link = ApolloLink.split(
        operation => operation.context.test,
        (operation, forward) => Observable.of({ data: { count: 1 } }),
        (operation, forward) => Observable.of({ data: { count: 2 } }),
      );

      let context = { test: true };

      testLinkResults({
        link,
        results: [{ count: 1 }],
        context,
      });

      context.test = false;

      testLinkResults({
        link,
        results: [{ count: 2 }],
        context,
        done,
      });
    });

    it('should split two Links', done => {
      const link = ApolloLink.split(
        operation => operation.context.test,
        (operation, forward) => Observable.of({ data: { count: 1 } }),
        new MockLink((operation, forward) =>
          Observable.of({ data: { count: 2 } }),
        ),
      );

      let context = { test: true };

      testLinkResults({
        link,
        results: [{ count: 1 }],
        context,
      });

      context.test = false;

      testLinkResults({
        link,
        results: [{ count: 2 }],
        context,
        done,
      });
    });

    it('should split a link and a function', done => {
      const link = ApolloLink.split(
        operation => operation.context.test,
        (operation, forward) => Observable.of({ data: { count: 1 } }),
        new MockLink((operation, forward) =>
          Observable.of({ data: { count: 2 } }),
        ),
      );

      let context = { test: true };

      testLinkResults({
        link,
        results: [{ count: 1 }],
        context,
      });

      context.test = false;

      testLinkResults({
        link,
        results: [{ count: 2 }],
        context,
        done,
      });
    });

    it('should allow concat after split to be join', done => {
      const context = { test: true };
      const link = ApolloLink.split(
        operation => operation.context.test,
        (operation, forward) =>
          forward(operation).map(data => ({
            data: { count: data.data.count + 1 },
          })),
      ).concat(() => Observable.of({ data: { count: 1 } }));

      testLinkResults({
        link,
        context,
        results: [{ count: 2 }],
      });

      context.test = false;

      testLinkResults({
        link,
        context,
        results: [{ count: 1 }],
        done,
      });
    });

    it('should allow default right to be passthrough', done => {
      const context = { test: true };
      const link = ApolloLink.split(
        operation => operation.context.test,
        operation => Observable.of({ data: { count: 2 } }),
      ).concat(operation => Observable.of({ data: { count: 1 } }));

      testLinkResults({
        link,
        context,
        results: [{ count: 2 }],
      });

      context.test = false;

      testLinkResults({
        link,
        context,
        results: [{ count: 1 }],
        done,
      });
    });
  });

  describe('execute', () => {
    let _warn: (message?: any, ...originalParams: any[]) => void;

    before(() => {
      _warn = console.warn;
      console.warn = sinon.stub().callsFake(warning => {
        assert.deepEqual(
          warning,
          `query should either be a string or GraphQL AST`,
        );
      });
    });

    after(() => {
      console.warn = _warn;
    });

    it('should return an empty observable when a link returns null', done => {
      testLinkResults({
        link: new MockLink(),
        results: [],
        done,
      });
    });

    it('should return an empty observable when a link is empty', done => {
      testLinkResults({
        link: ApolloLink.empty(),
        results: [],
        done,
      });
    });

    it("should return an empty observable when a concat'd link returns null", done => {
      const link = new MockLink((operation, forward) => {
        return forward(operation);
      }).concat(() => null);
      testLinkResults({
        link,
        results: [],
        done,
      });
    });

    it('should return an empty observable when a split link returns null', done => {
      let context = { test: true };
      const link = new SetContextLink(() => context).split(
        op => op.context.test,
        () => Observable.of(),
        () => null,
      );
      testLinkResults({
        link,
        results: [],
      });
      context.test = false;
      testLinkResults({
        link,
        results: [],
        done,
      });
    });

    it('should set a default context, variable, query and operationName on a copy of operation', done => {
      const operation = {};
      const link = ApolloLink.from([
        op => {
          assert.notProperty(operation, 'query');
          assert.notProperty(operation, 'operationName');
          assert.notProperty(operation, 'variables');
          assert.notProperty(operation, 'context');
          assert.property(op, 'query');
          assert.property(op, 'operationName');
          assert.property(op, 'variables');
          assert.property(op, 'context');
          return Observable.of();
        },
      ]);

      execute(link, operation).subscribe({
        complete: done,
      });
    });
  });
});

describe('Terminating links', () => {
  const _warn = console.warn;
  const warningStub = sinon.stub();
  const data = {
    stub: 'data',
  };

  before(() => {
    console.warn = warningStub;
  });

  beforeEach(() => {
    warningStub.reset();
    warningStub.callsFake(warning => {
      assert.deepEqual(
        warning.message,
        `You are calling concat on a terminating link, which will have no effect`,
      );
    });
  });

  after(() => {
    console.warn = _warn;
  });

  describe('concat', () => {
    it('should warn if attempting to concat to a terminating Link from function', () => {
      const link = ApolloLink.from([operation => Observable.of({ data })]);
      assert.deepEqual(
        link.concat((operation, forward) => forward(operation)),
        link,
      );
      assert(warningStub.calledOnce);
      assert.deepEqual(warningStub.firstCall.args[0].link, link);
    });

    it('should warn if attempting to concat to a terminating Link', () => {
      const link = new MockLink(operation => Observable.of());
      assert.deepEqual(
        link.concat((operation, forward) => forward(operation)),
        link,
      );
      assert(warningStub.calledOnce);
      assert.deepEqual(warningStub.firstCall.args[0].link, link);
    });

    it('should not warn if attempting concat a terminating Link at end', () => {
      const link = new MockLink((operation, forward) => forward(operation));
      link.concat(operation => Observable.of());
      assert(warningStub.notCalled);
    });
  });

  describe('split', () => {
    it('should not warn if attempting to split a terminating and non-terminating Link', () => {
      const split = ApolloLink.split(
        () => true,
        operation => Observable.of({ data }),
        (operation, forward) => forward(operation),
      );
      split.concat((operation, forward) => forward(operation));
      assert(warningStub.notCalled);
    });

    it('should warn if attempting to concat to split two terminating links', () => {
      const split = ApolloLink.split(
        () => true,
        operation => Observable.of({ data }),
        operation => Observable.of({ data }),
      );
      assert.deepEqual(
        split.concat((operation, forward) => forward(operation)),
        split,
      );
      assert(warningStub.calledOnce);
    });

    it('should warn if attempting to split to split two terminating links', () => {
      const split = ApolloLink.split(
        () => true,
        operation => Observable.of({ data }),
        operation => Observable.of({ data }),
      );
      assert.deepEqual(
        split.split(
          () => true,
          (operation, forward) => forward(operation),
          (operation, forward) => forward(operation),
        ),
        split,
      );
      assert(warningStub.calledOnce);
    });
  });

  describe('from', () => {
    it('should not warn if attempting to form a terminating then non-terminating Link', () => {
      ApolloLink.from([
        (operation, forward) => forward(operation),
        operation => Observable.of({ data }),
      ]);
      assert(warningStub.notCalled);
    });

    it('should warn if attempting to add link after termination', () => {
      ApolloLink.from([
        (operation, forward) => forward(operation),
        operation => Observable.of({ data }),
        (operation, forward) => forward(operation),
      ]);
      assert(warningStub.calledOnce);
    });

    it('should warn if attempting to add link after termination', () => {
      ApolloLink.from([
        (operation, forward) => forward(operation),
        operation => Observable.of({ data }),
        (operation, forward) => forward(operation),
      ]);
      assert(warningStub.calledOnce);
    });
  });

  describe('warning', () => {
    it('should include link that terminates', () => {
      const terminatingLink = new MockLink(operation =>
        Observable.of({ data }),
      );
      ApolloLink.from([
        (operation, forward) => forward(operation),
        (operation, forward) => forward(operation),
        terminatingLink,
        (operation, forward) => forward(operation),
        (operation, forward) => forward(operation),
        operation => Observable.of({ data }),
        (operation, forward) => forward(operation),
      ]);
      assert(warningStub.called);
    });
  });
});
