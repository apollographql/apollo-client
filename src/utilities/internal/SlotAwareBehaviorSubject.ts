import type { Slot } from "optimism";
import type { Observer, Subscription } from "rxjs";
import { BehaviorSubject } from "rxjs";

import { invariant } from "@apollo/client/utilities/invariant";

type SlotInstance<S> = InstanceType<typeof Slot<S>>;

export class SlotAwareBehaviorSubject<T, S> extends BehaviorSubject<T> {
  private slot: SlotInstance<S>;
  private currentSlotValue?: S;
  private callingSynchronusly = false;

  constructor(initialValue: T, slot: SlotInstance<S>, initialSlotValue?: S) {
    super(initialValue);
    this.slot = slot;
    this.currentSlotValue = initialSlotValue;
  }

  getSlotValue() {
    return this.currentSlotValue;
  }

  next(value: T): void {
    this.currentSlotValue = this.slot.getValue();
    try {
      this.callingSynchronusly = true;
      return super.next(value);
    } finally {
      this.callingSynchronusly = false;
    }
  }

  subscribe(
    observerOrNext?: Partial<Observer<T>> | ((value: T) => void) | null
  ): Subscription {
    invariant(
      observerOrNext && typeof observerOrNext === "object",
      "SlotAwareBehaviourSubject can only be used with an Observer object."
    );

    const { next } = observerOrNext;
    if (next) {
      const that = this;
      observerOrNext.next = function (...args: [T]) {
        if (!that.callingSynchronusly) {
          return that.slot.withValue(that.currentSlotValue!, next, args, this);
        }
        return next.apply(this, args);
      };
    }

    return super.subscribe(observerOrNext);
  }
}
