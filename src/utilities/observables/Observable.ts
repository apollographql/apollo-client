import type {
  Observer,
  Subscriber,
  Subscription as ObservableSubscription,
} from "zen-observable-ts";

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
