import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import gql from 'graphql-tag';
import { execute, ApolloLink, Observable, FetchResult } from 'apollo-link-core';

import RetryLink from '../src/retryLink';

const query = gql`
  {
    sample {
      id
    }
  }
`;

describe('RetryLink', () => {
  it('can be initialized', () => assert(true));

  it('should fail with unreachable endpoint', done => {
    const max = 10;
    const retry = new RetryLink({ delay: 1, max });
    const error = new Error('I never work');
    const stub = sinon.stub().callsFake(() => {
      return new Observable(observer => observer.error(error));
    });

    const link = ApolloLink.from([retry, stub]);

    execute(link, { query }).subscribe(
      expect.fail,
      actualError => {
        assert.deepEqual(stub.callCount, max);
        assert.deepEqual(error, actualError);
        done();
      },
      expect.fail,
    );
  });

  it('should return data from the underlying link on a successful operation', done => {
    const retry = new RetryLink();
    const data = <FetchResult>{
      data: {
        hello: 'world',
      },
    };
    const stub = sinon.stub();
    stub.returns(Observable.of(data));

    const link = ApolloLink.from([retry, stub]);

    execute(link, { query }).subscribe(
      actualData => {
        assert(stub.calledOnce);
        assert.deepEqual(data, actualData);
      },
      expect.fail,
      done,
    );
  });

  it('should return data from the underlying link on a successful retry', done => {
    const retry = new RetryLink({ delay: 1, max: 2 });
    const error = new Error('I never work');
    const data = <FetchResult>{
      data: {
        hello: 'world',
      },
    };
    const stub = sinon.stub();
    stub
      .onFirstCall()
      .returns(new Observable(observer => observer.error(error)));
    stub.onSecondCall().returns(Observable.of(data));

    const link = ApolloLink.from([retry, stub]);

    execute(link, { query }).subscribe(
      actualData => {
        assert.deepEqual(stub.callCount, 2);
        assert.deepEqual(data, actualData);
      },
      expect.fail,
      done,
    );
  });
});
