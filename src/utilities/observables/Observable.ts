import Observable from 'zen-observable';

// This simplified polyfill attempts to follow the ECMAScript Observable
// proposal (https://github.com/zenparsing/es-observable)
import 'symbol-observable';

export type ObservableSubscription = ZenObservable.Subscription;
export type Observer<T> = ZenObservable.Observer<T>;
export type Subscriber<T> = ZenObservable.Subscriber<T>;

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
