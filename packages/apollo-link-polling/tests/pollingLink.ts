import { assert, expect } from 'chai';
import * as sinon from 'sinon';

import PollingLink from '../src/pollingLink';
import { execute, Observable } from 'apollo-link-core';

import gql from 'graphql-tag';

const query = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

describe('PollingLink', () => {
  it('should construct with an interval', () => {
    assert.doesNotThrow(() => new PollingLink(() => null));
  });

  it('should construct with an interval', () => {
    assert.doesNotThrow(() => new PollingLink(() => 1));
  });

  it('should poll request', done => {
    let count = 0;
    let subscription;
    const spy = sinon.spy();
    const checkResults = () => {
      const calls = spy.getCalls();
      calls.map((call, i) => assert.deepEqual(call.args[0].data.count, i));
      assert.deepEqual(calls.length, 5);
      done();
    };

    const poll = new PollingLink(() => 1).concat(() => {
      if (count >= 5) {
        subscription.unsubscribe();
        checkResults();
      }
      return Observable.of({
        data: {
          count: count++,
        },
      });
    });

    subscription = execute(poll, { query }).subscribe({
      next: spy,
      error: error => expect.fail(null, null, error.message),
      complete: () => expect.fail(),
    });
  });

  it('should poll request until error', done => {
    let count = 0;
    let subscription;
    const error = new Error('End polling');
    const spy = sinon.spy();
    const checkResults = actualError => {
      assert.deepEqual(error, actualError);
      const calls = spy.getCalls();
      calls.map((call, i) => assert.deepEqual(call.args[0].data.count, i));
      assert.deepEqual(calls.length, 5);
      done();
    };

    const poll = new PollingLink(() => 1).concat(() => {
      if (count >= 5) {
        return new Observable(observer => {
          throw error;
        });
      }

      return Observable.of({
        data: {
          count: count++,
        },
      });
    });

    subscription = execute(poll, { query }).subscribe({
      next: spy,
      error: err => checkResults(err),
      complete: () => expect.fail(),
    });
  });
});
