import { toPromise } from '../toPromise';
import { fromError, } from '../fromError';
import { itAsync } from '../../../testing';

describe('fromError', () => {
  itAsync('acts as error call', async (resolve, reject) => {
    const error = new Error('I always error');
    const observable = fromError(error);
    toPromise(observable)
      .then(() => { reject("should not have thrown") })
      .catch((actualError) => {
        expect(error).toEqual(actualError);
        resolve();
      });
  });
});
