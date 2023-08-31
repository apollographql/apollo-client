import * as React from "react";
import type { ReactiveVar } from "../../core/index.js";

export function useReactiveVar<T>(rv: ReactiveVar<T>): T {
  const value = rv();

  // We don't actually care what useState thinks the value of the variable is,
  // so we take only the update function from the returned array.
  const setValue = React.useState(value)[1];

  // We subscribe to variable updates on initial mount and when the value has
  // changed. This avoids a subtle bug in React.StrictMode where multiple
  // listeners are added, leading to inconsistent updates.
  React.useEffect(() => {
    // Catch any potential state changes that might have happened between when
    // this useReactiveVar was called and this useEffect callback was scheduled
    // for async execution.
    const probablySameValue = rv();
    if (value !== probablySameValue) {
      // If the value of rv has already changed, we don't need to listen for the
      // next change, because we can report this change immediately.
      setValue(probablySameValue);
      return;
    }

    // By reusing the same onNext function in the nested call to
    // rv.onNextChange(onNext), we can keep using the initial clean-up function
    // returned by rv.onNextChange(function onNext(v){...}), without having to
    // register the new clean-up function (returned by the nested
    // rv.onNextChange(onNext)) with yet another useEffect.
    return rv.onNextChange(function onNext(v) {
      setValue(v);
      rv.onNextChange(onNext);
    });
  }, [rv]);

  return value;
}
