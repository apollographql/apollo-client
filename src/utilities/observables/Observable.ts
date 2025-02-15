import type {
  Observer,
  Subscription as ObservableSubscription,
  Subscriber,
} from "zen-observable-ts";

// This simplified polyfill attempts to follow the ECMAScript Observable
// proposal (https://github.com/zenparsing/es-observable)
import "symbol-observable";

export type {
  /** @deprecated */
  Observer,

  /** @deprecated */
  ObservableSubscription,

  /** @deprecated */
  Subscriber,
};
