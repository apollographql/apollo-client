import type { Slot } from "optimism";
import type { Observer, Subscription } from "rxjs";
import { BehaviorSubject } from "rxjs";

import { invariant } from "@apollo/client/utilities/invariant";

type SlotInstance = InstanceType<typeof Slot>;

export class SlotAwareBehaviorSubject<T> extends BehaviorSubject<T> {
  private slots: SlotInstance[];
  private currentSlotValues: Array<[SlotInstance, value: unknown]>;
  callingSynchronusly = false;

  constructor(value: T, initialSlots: Array<[SlotInstance, value: unknown]>) {
    super(value);
    this.slots = initialSlots.map(([slot]) => slot);
    this.currentSlotValues = initialSlots;
  }

  getSlotValue<T>(slot: { getValue: () => T | undefined }) {
    return this.currentSlotValues?.find(([s]) => s === slot)?.[1] as
      | T
      | undefined;
  }

  next(value: T): void {
    this.currentSlotValues = [];
    for (const slot of this.slots) {
      if (slot.hasValue()) {
        this.currentSlotValues.push([slot, slot.getValue()]);
      }
    }
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
        let cb = next;
        if (!that.callingSynchronusly) {
          console.log("applying slot values", that.currentSlotValues);
          for (const [slot, value] of that.currentSlotValues) {
            cb = slot.withValue.bind(slot, value, cb, args, this);
          }
        }
        return cb.apply(this, args);
      };
    }

    return super.subscribe(observerOrNext);
  }
}
