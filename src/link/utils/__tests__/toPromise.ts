import { Observable } from '../../../utilities/observables/Observable';
import { toPromise } from '../toPromise';
import { fromError } from '../fromError';

describe('toPromise', () => {
  const data = {
    data: {
      hello: 'world',
    },
  };
  const error = new Error('I always error');

  it('return next call as Promise resolution', () => {
    return toPromise(Observable.of(data)).then(result =>
      expect(data).toEqual(result),
    );
  });

  it('return error call as Promise rejection', () => {
    return toPromise(fromError(error))
      .then(fail)
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
      toPromise(Observable.of(data, data)).then(result => {
        expect(data).toEqual(result);
        expect(spy).toHaveBeenCalled();
        done();
      });
    });
  });
});
