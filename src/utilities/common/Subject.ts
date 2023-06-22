import { Observable, SubscriptionObserver } from "zen-observable-ts";
import { fixObservableSubclass } from "../observables/subclassing";

export class Subject<T> extends Observable<T> {
  private subscribers = new Set<SubscriptionObserver<T>>();
  constructor() {
    super((s) => {
      this.subscribers.add(s);
      return () => this.subscribers.delete(s);
    });
  }
  next(value: T) {
    this.subscribers.forEach((s) => s.next(value));
  }
}

// Necessary because the Subject constructor has a different
// signature than the Observable constructor.
fixObservableSubclass(Subject);
