import {
  Observable,
  Observer,
  Subscription as ObservableSubscription,
} from 'zen-observable-ts';

// This simplified polyfill attempts to follow the ECMAScript Observable
// proposal (https://github.com/zenparsing/es-observable)
import 'symbol-observable';

export type Subscriber<T> = ZenObservable.Subscriber<T>;
export type {
  Observer,
  ObservableSubscription,
};

Observable.call = function<T>(
  this: typeof Observable,
  obs: Observable<T>,
  sub: ZenObservable.Subscriber<T>,
): Observable<T> {
  return construct(this, obs, sub);
};

Observable.apply = function<T>(
  this: typeof Observable,
  obs: Observable<T>,
  args: [ZenObservable.Subscriber<T>],
): Observable<T> {
  return construct(this, obs, args[0]);
}

function construct<T>(
  Super: typeof Observable,
  self: Observable<T>,
  subscriber: ZenObservable.Subscriber<T>,
): Observable<T> {
  return typeof Reflect === 'object'
    ? Reflect.construct(Super, [subscriber], self.constructor)
    : Function.prototype.call.call(Super, self, subscriber);
}

// Use global module augmentation to add RxJS interop functionality. By
// using this approach (instead of subclassing `Observable` and adding an
// ['@@observable']() method), we ensure the exported `Observable` retains all
// existing type declarations from `@types/zen-observable` (which is important
// for projects like `apollo-link`).
declare global {
  interface Observable<T> {
    ['@@observable'](): Observable<T>;
  }
}
(Observable.prototype as any)['@@observable'] = function () { return this; };

export { Observable };
