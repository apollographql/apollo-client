import * as chai from 'chai';
import Observable from '../src/zenObservable';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('forEach ', () => {
  it('throws on not a function', () => {
    return assert.throws(Observable.from([1, 2, 3, 4]).forEach(<any>1).then);
  });

  it('throws on not a function', () => {
    const error = new Error('completed');
    return new Observable<number>(observer => {
      observer.complete();
      throw error;
    })
      .forEach(x => x)
      .catch(err => assert.deepEqual(err, error));
  });
});
