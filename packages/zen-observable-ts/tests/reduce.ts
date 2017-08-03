import * as chai from 'chai';
import Observable from '../src/zenObservable';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const assert = chai.assert;

describe('reduce ', () => {
  it('No seed', () => {
    return Observable.from([1, 2, 3, 4, 5, 6])
      .reduce((a, b) => {
        return a + b;
      })
      .forEach(x => {
        assert.equal(x, 21);
      });
  });

  it('No seed - one value', () => {
    return Observable.from([1])
      .reduce((a, b) => {
        return a + b;
      })
      .forEach(x => {
        assert.equal(x, 1);
      });
  });

  it('No seed - empty (throws)', () => {
    return Observable.from([])
      .reduce((a, b) => {
        return a + b;
      })
      .forEach(() => null)
      .then(() => assert(false), () => assert(true));
  });

  it('Seed', () => {
    return Observable.from([1, 2, 3, 4, 5, 6])
      .reduce((a, b) => {
        return a + b;
      }, 100)
      .forEach(x => {
        assert.equal(x, 121);
      });
  });

  it('Seed - empty', () => {
    return Observable.from([])
      .reduce((a, b) => {
        return a + b;
      }, 100)
      .forEach(x => {
        assert.equal(x, 100);
      });
  });

  it('throws on not a function', () => {
    return assert.throws(
      () =>
        Observable.from([1, 2, 3, 4]).reduce(<any>1).forEach(x => void 0).then,
    );
  });

  it('throws on error inside function', done => {
    const error = new Error('thrown');
    return assert.doesNotThrow(() =>
      Observable.from([1, 2, 3, 4])
        .reduce(() => {
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
      () =>
        obs
          .reduce((a, b) => {
            return a + b;
          }, 100)
          .forEach(x => {
            assert.equal(x, 110);
          }).then,
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
      () =>
        obs
          .reduce((a, b) => {
            return a + b;
          }, 100)
          .forEach(x => {
            assert.equal(x, 102);
          }).then,
    );
  });
});
