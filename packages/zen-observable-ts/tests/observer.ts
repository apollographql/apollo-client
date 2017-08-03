import { assert } from 'chai';
import * as sinon from 'sinon';
import Observable from '../src/zenObservable';

describe('of', () => {
  it('Basics', () => {
    let list: Array<number> = [];

    return Observable.of(1, 2, 3)
      .map(x => x * 2)
      .forEach(x => list.push(x))
      .then(() => assert.deepEqual(list, [2, 4, 6]));
  });
});

describe('subscription', () => {
  it('can close multiple times', () => {
    const sub = Observable.of(1).subscribe({});
    sub.unsubscribe();
    sub.unsubscribe();
  });

  it('can close multiple times', () => {
    let sub = Observable.of(1, 2).subscribe({});
    sub = Observable.of(1, 2).subscribe({
      next: sub.unsubscribe,
    });
  });
});

describe('observer', () => {
  it('throws when cleanup is not a function', () => {
    assert.throws(() => {
      const sub = new Observable<number>(observer => {
        return <any>1;
      }).subscribe({});
      sub.unsubscribe();
    });
  });

  it('recalling next, error, complete have no effect', () => {
    const spy = sinon.spy();
    const list: Array<number> = [];
    return new Observable<number>(observer => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.complete();
      observer.next(4);
      observer.complete();
      spy();
    })
      .map(x => x * 2)
      .forEach(x => list.push(x))
      .then(() => assert.deepEqual(list, [2, 4, 6]))
      .then(() => assert(spy.called));
  });

  it('throws on non function Observer', () => {
    assert.throws(() => new Observable<number>(<any>1));
  });

  it('completes after error', () => {
    const error = new Error('completed');
    return new Promise((resolve, reject) =>
      new Observable<number>(observer => {
        observer.complete();
      }).subscribe({
        complete: () => {
          reject(error);
        },
      }),
    ).catch(err => assert.deepEqual(err, error));
  });

  it('calling without options does not throw', () => {
    new Observable<number>(observer => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.complete();
    }).subscribe({});
  });

  it('calling without options does not throw', () => {
    let num = 0;
    return new Promise((resolve, reject) => {
      new Observable<number>(observer => {
        observer.next(1);
        observer.next(2);
        observer.next(3);
        observer.complete();
      }).subscribe(val => assert.equal(++num, val), reject, resolve);
    });
  });

  it('throws error after complete', () => {
    const spy = sinon.spy();
    const error = new Error('throws');
    return new Promise((resolve, reject) => {
      new Observable<number>(observer => {
        observer.complete();
        observer.error(error);
        spy();
      }).subscribe({
        next: reject,
        error: reject,
      });
    }).catch(err => {
      assert(spy.notCalled);
      assert.deepEqual(err, error);
    });
  });
});
