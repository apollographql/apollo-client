import { Subscription, Observer, Observable } from './Observable';

export function observableShare<T>(obs: Observable<T>, replayCount: number = 0): Observable<T> {
  let observers: Array<Observer<T>> = [];
  let replayBuffer: Array<T> = [];
  let subscription: Subscription | undefined;

  return new Observable((observer: Observer<T>) => {
    observers.push(observer);

    if (observers.length === 1) {
      subscription = obs.subscribe({
        next: (v) => {
          if ( replayCount != 0 ) {
            replayBuffer.push(v);
            if ( replayBuffer.length > replayCount ) {
              replayBuffer.shift();
            }
          }

          observers.forEach((curObs) => {
            curObs.next && curObs.next(v);
          });
        },
        error: (e) => observers.forEach((curObs) => {
          curObs.error && curObs.error(e);
        }),
        complete: () => observers.forEach((curObs) => {
          curObs.complete && curObs.complete();
        }),
      });
    }

    // Notify the new observer about replays.
    replayBuffer.forEach((v) => {
      observer.next && observer.next(v);
    });

    return () => {
      observers = observers.filter((curObs) => curObs !== observer);

      // If we removed the last observer, unsubscribe
      if (observers.length === 0) {
        subscription && subscription.unsubscribe();
        subscription = undefined;
      }
    }
  });
}
