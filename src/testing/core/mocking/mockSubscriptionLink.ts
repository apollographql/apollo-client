import { Observable } from "rxjs";

import { ApolloLink } from "@apollo/client/link";

export declare namespace MockSubscriptionLink {
  export interface Result {
    result?: ApolloLink.Result;
    error?: Error;
    delay?: number;
  }
}

export class MockSubscriptionLink extends ApolloLink {
  public unsubscribers: any[] = [];
  public setups: any[] = [];
  public operation?: ApolloLink.Operation;

  private observers: any[] = [];

  constructor() {
    super();
  }

  public request(operation: ApolloLink.Operation) {
    this.operation = operation;
    return new Observable<ApolloLink.Result>((observer) => {
      this.setups.forEach((x) => x());
      this.observers.push(observer);
      return () => {
        this.unsubscribers.forEach((x) => x());
      };
    });
  }

  public simulateResult(result: MockSubscriptionLink.Result, complete = false) {
    setTimeout(() => {
      const { observers } = this;
      if (!observers.length) throw new Error("subscription torn down");
      observers.forEach((observer) => {
        if (result.result && observer.next) observer.next(result.result);
        if (result.error && observer.error) observer.error(result.error);
        if (complete && observer.complete) observer.complete();
      });
    }, result.delay || 0);
  }

  public simulateComplete() {
    const { observers } = this;
    if (!observers.length) throw new Error("subscription torn down");
    observers.forEach((observer) => {
      if (observer.complete) observer.complete();
    });
  }

  public onSetup(listener: any): void {
    this.setups = this.setups.concat([listener]);
  }

  public onUnsubscribe(listener: any): void {
    this.unsubscribers = this.unsubscribers.concat([listener]);
  }
}
