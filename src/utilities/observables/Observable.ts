import type {
  Observer,
  Subscriber,
  Subscription as ObservableSubscription,
} from "zen-observable-ts";
import { Observable } from "zen-observable-ts";

// This simplified polyfill attempts to follow the ECMAScript Observable
// proposal (https://github.com/zenparsing/es-observable)
import "symbol-observable";

export type {
  /** @deprecated */
  ObservableSubscription,

  /** @deprecated */
  Observer,

  /** @deprecated */
  Subscriber,
};

// The zen-observable package defines Observable.prototype[Symbol.observable]
// when Symbol is supported, but RxJS interop depends on also setting this fake
// '@@observable' string as a polyfill for Symbol.observable.
const { prototype } = Observable;
const fakeObsSymbol = "@@observable" as keyof typeof prototype;
if (!prototype[fakeObsSymbol]) {
  // @ts-expect-error
  prototype[fakeObsSymbol] = function () {
    return this;
  };
}

export {
  /** @deprecated */
  Observable,
};
