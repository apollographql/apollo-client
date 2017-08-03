import * as chai from 'chai';
import Observable from '../src/zenObservable';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('flatMap', () => {
  it('Observable.from', () => {
    let list: Array<number> = [];

    return Observable.from([1, 2, 3])
      .flatMap(x => {
        return Observable.from([x * 1, x * 2, x * 3]);
      })
      .forEach(x => {
        list.push(x);
      })
      .then(() => {
        assert.deepEqual(list, [1, 2, 3, 2, 4, 6, 3, 6, 9]);
      });
  });

  it('Error if return value is not observable', () => {
    return Observable.from([1, 2, 3])
      .flatMap(() => {
        return <any>1;
      })
      .forEach(() => null)
      .then(() => assert(false), () => assert(true));
  });

  it('throws on not a function', () => {
    return assert.throws(
      () =>
        Observable.from([1, 2, 3, 4]).flatMap(<any>1).forEach(x => void 0).then,
    );
  });

  it('throws on error inside function', done => {
    const error = new Error('thrown');
    return assert.doesNotThrow(() =>
      Observable.from([1, 2, 3, 4])
        .flatMap(() => {
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

  it('calls inner unsubscribe', done => {
    Observable.from(Observable.of(1))
      .flatMap(x => {
        return new Observable(observer => done);
      })
      .subscribe({})
      .unsubscribe();
  });

  it('does not throw on closed subscription', () => {
    const list: Array<number> = [];
    const obs = Observable.from([1, 2, 3, 4]);
    obs.subscribe({}).unsubscribe();
    return assert.doesNotThrow(
      () =>
        obs
          .flatMap(x => {
            return Observable.from([x * 1, x * 2, x * 3]);
          })
          .forEach(x => {
            list.push(x);
          }).then,
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
    obs.subscribe({}).unsubscribe();
    return assert.doesNotThrow(
      () =>
        obs
          .flatMap(x => {
            return Observable.from([x * 1, x * 2, x * 3]);
          })
          .forEach(x => {
            list.push(x);
          }).then,
    );
  });
});
