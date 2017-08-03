import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import HttpLink from '../src/httpLink';

import * as Links from 'apollo-link-core';
import { ApolloLink, execute } from 'apollo-link-core';

import { createApolloFetch } from 'apollo-fetch';

import { print } from 'graphql';
import gql from 'graphql-tag';
import * as fetchMock from 'fetch-mock';

const sampleQuery = gql`
  query SampleQuery {
    stub {
      id
    }
  }
`;

const sampleMutation = gql`
  mutation SampleMutation {
    stub(param: "value") {
      id
    }
  }
`;

describe('HttpLink', () => {
  const data = { hello: 'world', method: 'POST' };
  const mockError = { throws: new TypeError('mock me') };

  let subscriber;

  beforeEach(() => {
    fetchMock.post('begin:data', data);
    fetchMock.post('begin:error', mockError);

    const next = sinon.spy();
    const error = sinon.spy();
    const complete = sinon.spy();

    subscriber = {
      next,
      error,
      complete,
    };
  });

  afterEach(() => {
    fetchMock.restore();
  });

  it('raises warning if called with concat', () => {
    const link = ApolloLink.from([new HttpLink()]);
    const _warn = console.warn;
    console.warn = warning => assert.property(warning, 'message');
    assert.deepEqual(
      link.concat((operation, forward) => forward(operation)),
      link,
    );
    console.warn = _warn;
  });

  it('does not need any constructor arguments', () => {
    assert.doesNotThrow(() => new HttpLink());
  });

  it('calls next and then complete', done => {
    const next = sinon.spy();
    const link = new HttpLink({ uri: 'data' });
    const observable = execute(link, {
      query: sampleQuery,
    });
    observable.subscribe({
      next,
      error: error => assert(false),
      complete: () => {
        assert(next.calledOnce);
        done();
      },
    });
  });

  it('calls error when fetch fails', done => {
    const link = new HttpLink({ uri: 'error' });
    const observable = execute(link, {
      query: sampleQuery,
    });
    observable.subscribe(
      result => assert(false),
      error => {
        assert.equal(error, mockError.throws);
        done();
      },
      () => {
        assert(false);
        done();
      },
    );
  });

  it('calls error when fetch fails', done => {
    const link = new HttpLink({ uri: 'error' });
    const observable = execute(link, {
      query: sampleMutation,
    });
    observable.subscribe(
      result => assert(false),
      error => {
        assert.equal(error, mockError.throws);
        done();
      },
      () => {
        assert(false);
        done();
      },
    );
  });

  it('unsubscribes without calling subscriber', done => {
    const link = new HttpLink({ uri: 'data' });
    const observable = execute(link, {
      query: sampleQuery,
    });
    const subscription = observable.subscribe(
      () => assert(false),
      () => assert(false),
      () => assert(false),
    );
    subscription.unsubscribe();
    assert(subscription.closed);
    setTimeout(done, 50);
  });

  const verifyRequest = (link: ApolloLink, after: () => void) => {
    const next = sinon.spy();
    const context = { info: 'stub' };
    const variables = { params: 'stub' };

    const observable = execute(link, {
      query: sampleMutation,
      context,
      variables,
    });
    observable.subscribe({
      next,
      error: error => assert(false),
      complete: () => {
        const body = JSON.parse(fetchMock.lastCall()[1].body);
        assert.equal(body.query, print(sampleMutation));
        assert.deepEqual(body.context, context);
        assert.deepEqual(body.variables, variables);

        assert.equal(next.callCount, 1);

        after();
      },
    });
  };

  it('passes all arguments to multiple fetch body', done => {
    const link = new HttpLink({ uri: 'data' });
    verifyRequest(link, () => verifyRequest(link, done));
  });

  it('calls multiple subscribers', done => {
    const link = new HttpLink({ uri: 'data' });
    const context = { info: 'stub' };
    const variables = { params: 'stub' };

    const observable = execute(link, {
      query: sampleMutation,
      context,
      variables,
    });
    observable.subscribe(subscriber);
    observable.subscribe(subscriber);

    setTimeout(() => {
      assert(subscriber.next.calledTwice);
      assert(subscriber.error.notCalled);
      assert(subscriber.complete.calledTwice);
      done();
    }, 50);
  });

  it('calls remaining subscribers after unsubscribe', done => {
    const link = new HttpLink({ uri: 'data' });
    const context = { info: 'stub' };
    const variables = { params: 'stub' };

    const observable = execute(link, {
      query: sampleMutation,
      context,
      variables,
    });
    observable.subscribe(subscriber);
    const subscription = observable.subscribe(subscriber);
    subscription.unsubscribe();

    setTimeout(() => {
      assert(subscriber.next.calledOnce);
      assert(subscriber.error.notCalled);
      assert(subscriber.complete.calledOnce);
      done();
    }, 50);
  });

  it('should add headers from the context', done => {
    const fetch = createApolloFetch({
      customFetch: (request, options) =>
        new Promise((resolve, reject) => {
          assert.property(options.headers, 'test');
          assert.deepEqual(options.headers.test, context.headers.test);
          done();
        }),
    });
    const link = new HttpLink({ fetch });

    const context = {
      headers: {
        test: 'header',
      },
    };

    Links.execute(link, { query: sampleQuery, context }).subscribe(expect.fail);
  });
});
