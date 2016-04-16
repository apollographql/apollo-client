// Observable<T> and Observer<T> follow the current version of the ECMAScript proposal.
// See https://github.com/zenparsing/es-observable

export interface Observable<T> {
  subscribe(observer: Observer<T>): Subscription
}

export interface Observer<T> {
  next?: (value: T) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

export interface Subscription {
  unsubscribe: () => void
}
