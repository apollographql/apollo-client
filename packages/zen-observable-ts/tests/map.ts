import * as chai from 'chai';
import Observable from '../src/zenObservable';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('map', () => {
  it('Basics', () => {
    let list: Array<number> = [];

    return Observable.from([1, 2, 3])
      .map(x => x * 2)
      .forEach(x => list.push(x))
      .then(() => assert.deepEqual(list, [2, 4, 6]));
  });

  it('throws on not a function', () => {
    return assert.throws(
      () => Observable.from([1, 2, 3, 4]).map(<any>1).forEach(x => void 0).then,
    );
  });

  it('throws on error inside function', done => {
    const error = new Error('thrown');
    return assert.doesNotThrow(() =>
      Observable.from([1, 2, 3, 4])
        .map(() => {
          throw error;
        })
        .subscribe({
          error: err => {
            assert.equal(err, error);
            done();
          },
        }),
    );
  });

  it('does not throw on closed subscription', () => {
    const obs = Observable.from([1, 2, 3, 4]);
    obs.subscribe({}).unsubscribe();
    return assert.doesNotThrow(
      () => obs.map(x => x * 2).forEach(x => void 0).then,
    );
  });

  it('does not throw on internally closed subscription', () => {
    const obs = new Observable<number>(observer => {
      observer.next(1);
      observer.next(1);
      observer.complete();
      observer.next(1);
    });
    return assert.doesNotThrow(
      () => obs.map(x => x * 2).forEach(x => void 0).then,
    );
  });
});
