import { assert, expect } from 'chai';
import * as sinon from 'sinon';
import * as LinkUtils from '../src/linkUtils';
import Observable from 'zen-observable-ts';

describe('Link utilities:', () => {
  describe('validateOperation', () => {
    it('should throw when invalid field in operation', () => {
      assert.throws(() =>
        LinkUtils.validateOperation(
          <any>{
            qwerty: '',
          },
        ),
      );
    });

    it('should not throw when valid fields in operation', () => {
      assert.doesNotThrow(() =>
        LinkUtils.validateOperation({
          query: '',
          context: {},
          variables: {},
        }),
      );
    });
  });

  describe('makePromise', () => {
    const data = {
      data: {
        hello: 'world',
      },
    };
    const error = new Error('I always error');

    it('return next call as Promise resolution', () => {
      return LinkUtils.makePromise(Observable.of(data)).then(result =>
        assert.deepEqual(data, result),
      );
    });

    it('return error call as Promise rejection', () => {
      return LinkUtils.makePromise(
        new Observable(observer => observer.error(error)),
      )
        .then(expect.fail)
        .catch(actualError => assert.deepEqual(error, actualError));
    });

    describe('warnings', () => {
      const spy = sinon.stub();
      let _warn: (message?: any, ...originalParams: any[]) => void;

      before(() => {
        _warn = console.warn;
        console.warn = spy;
      });

      after(() => {
        console.warn = _warn;
      });

      it('return error call as Promise rejection', done => {
        spy.callsFake(() => done());
        LinkUtils.makePromise(Observable.of(data, data)).then(result =>
          assert.deepEqual(data, result),
        );
      });
    });
  });
});
