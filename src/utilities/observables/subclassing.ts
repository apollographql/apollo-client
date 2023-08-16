import { Observable } from "./Observable.js";
import { canUseSymbol } from "../common/canUse.js";

// Generic implementations of Observable.prototype methods like map and
// filter need to know how to create a new Observable from an Observable
// subclass (like Concast or ObservableQuery). Those methods assume
// (perhaps unwisely?) that they can call the subtype's constructor with a
// Subscriber function, even though the subclass constructor might expect
// different parameters. Defining this static Symbol.species property on
// the subclass is a hint to generic Observable code to use the default
// constructor instead of trying to do `new Subclass(observer => ...)`.
export function fixObservableSubclass<
  S extends new (...args: any[]) => Observable<any>,
>(subclass: S): S {
  function set(key: symbol | string) {
    // Object.defineProperty is necessary because the Symbol.species
    // property is a getter by default in modern JS environments, so we
    // can't assign to it with a normal assignment expression.
    Object.defineProperty(subclass, key, { value: Observable });
  }
  if (canUseSymbol && Symbol.species) {
    set(Symbol.species);
  }
  // The "@@species" string is used as a fake Symbol.species value in some
  // polyfill systems (including the SymbolSpecies variable used by
  // zen-observable), so we should set it as well, to be safe.
  set("@@species");
  return subclass;
}
