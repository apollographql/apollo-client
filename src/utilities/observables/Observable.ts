import Observable from 'zen-observable';

// This simplified polyfill attempts to follow the ECMAScript Observable
// proposal (https://github.com/zenparsing/es-observable)
import 'symbol-observable';

export type ObservableSubscription = ZenObservable.Subscription;
export type Observer<T> = ZenObservable.Observer<T>;
export type Subscriber<T> = ZenObservable.Subscriber<T>;

// The zen-observable package defines Observable.prototype[Symbol.observable]
// when Symbol is supported, but RxJS interop depends on also setting this fake
// '@@observable' string as a polyfill for Symbol.observable.
const { prototype } = Observable;
const fakeObsSymbol = '@@observable' as keyof typeof prototype;
if (!prototype[fakeObsSymbol]) {
  prototype[fakeObsSymbol] = function () { return this; };
}

export { Observable };
