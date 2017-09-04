// This simplified polyfill attempts to follow the ECMAScript Observable proposal.
// See https://github.com/zenparsing/es-observable
import { Observable as LinkObservable } from 'apollo-link-core';
import $$observable from 'symbol-observable';

// rxjs interopt
export class Observable<T> extends LinkObservable<T> {
  public [$$observable]() {
    return this;
  }
}
