import {
  validateOperation,
  fromPromise,
  makePromise,
  fromError,
} from '../linkUtils';
import Observable from 'zen-observable';

describe('Link utilities:', () => {
  describe('validateOperation', () => {
    it('should throw when invalid field in operation', () => {
      expect(() => validateOperation(<any>{ qwerty: '' })).toThrow();
    });

    it('should not throw when valid fields in operation', () => {
      expect(() =>
        validateOperation({
          query: '1234',
          context: {},
          variables: {},
        }),
      ).not.toThrow();
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
      return makePromise(Observable.of(data)).then(result =>
        expect(data).toEqual(result),
      );
    });

    it('return error call as Promise rejection', () => {
      return makePromise(fromError(error))
        .then(expect.fail)
        .catch(actualError => expect(error).toEqual(actualError));
    });

    describe('warnings', () => {
      const spy = jest.fn();
      let _warn: (message?: any, ...originalParams: any[]) => void;

      beforeEach(() => {
        _warn = console.warn;
        console.warn = spy;
      });

      afterEach(() => {
        console.warn = _warn;
      });

      it('return error call as Promise rejection', done => {
        makePromise(Observable.of(data, data)).then(result => {
          expect(data).toEqual(result);
          expect(spy).toHaveBeenCalled();
          done();
        });
      });
    });
  });
  describe('fromPromise', () => {
    const data = {
      data: {
        hello: 'world',
      },
    };
    const error = new Error('I always error');

    it('return next call as Promise resolution', () => {
      const observable = fromPromise(Promise.resolve(data));
      return makePromise(observable).then(result =>
        expect(data).toEqual(result),
      );
    });

    it('return Promise rejection as error call', () => {
      const observable = fromPromise(Promise.reject(error));
      return makePromise(observable)
        .then(expect.fail)
        .catch(actualError => expect(error).toEqual(actualError));
    });
  });
  describe('fromError', () => {
    it('acts as error call', () => {
      const error = new Error('I always error');
      const observable = fromError(error);
      return makePromise(observable)
        .then(expect.fail)
        .catch(actualError => expect(error).toEqual(actualError));
    });
  });
});
