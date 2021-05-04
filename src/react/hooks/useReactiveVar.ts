import { useEffect, useLayoutEffect, useState } from 'react';
import { ReactiveVar } from '../../core';

const isBrowser = typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement !== 'undefined';

const useIsomorphicEffect = isBrowser ? useLayoutEffect : useEffect;

export function useReactiveVar<T>(rv: ReactiveVar<T>): T {
  const value = rv();

  // We don't actually care what useState thinks the value of the variable
  // is, so we take only the update function from the returned array.
  const [, setValue] = useState(value);

  // We subscribe to variable updates on initial mount and when the value has
  // changed. This avoids a subtle bug in React.StrictMode where multiple listeners
  // are added, leading to inconsistent updates.
  useIsomorphicEffect(() => {
    const probablySameValue = rv();
    if (value !== probablySameValue) {
      // If the value of rv has already changed, we don't need to listen for the
      // next change, because we can report this change immediately.
      setValue(probablySameValue);
    } else {
      return rv.onNextChange(setValue);
    }
  }, [value]);

  // We check the variable's value in this useEffect and schedule an update if
  // the value has changed. This check occurs once, on the initial render, to avoid
  // a useEffect higher in the component tree changing a variable's value
  // before the above useEffect can set the onNextChange handler. Note that React
  // will not schedule an update if setState is called with the same value as before.
  useEffect(() => setValue(rv()), []);

  return value;
}
