import * as chai from 'chai';
import Observable from '../src/zenObservable';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('filter ', () => {
  it('Basics', () => {
    const list: Array<number> = [];

    return Observable.from([1, 2, 3, 4])
      .filter(x => x > 2)
      .forEach(x => list.push(x))
      .then(() => assert.deepEqual(list, [3, 4]));
  });

  it('throws on not a function', () => {
    const list: Array<number> = [];
    return assert.throws(
      () =>
        Observable.from([1, 2, 3, 4]).filter(<any>1).forEach(x => list.push(x))
          .then,
    );
  });

  it('throws on error inside function', done => {
    const error = new Error('thrown');
    return assert.doesNotThrow(() =>
      Observable.from([1, 2, 3, 4])
        .filter(() => {
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
    const list: Array<number> = [];
    const obs = Observable.from([1, 2, 3, 4]);
    obs.subscribe({}).unsubscribe();
    return assert.doesNotThrow(
      () => obs.filter(x => x > 2).forEach(x => list.push(x)).then,
    );
  });

  it('does not throw on internally closed subscription', () => {
    const list: Array<number> = [];
    const obs = new Observable<number>(observer => {
      observer.next(1);
      observer.next(1);
      observer.complete();
      observer.next(1);
    });

    return assert.doesNotThrow(
      () => obs.filter(x => x > 2).forEach(x => list.push(x)).then,
    );
  });
});
