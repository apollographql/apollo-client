import { useState, useEffect } from 'react';
import { ReactiveVar } from '../../core';

export function useReactiveVar<T>(rv: ReactiveVar<T>): T {
  const value = rv();
  // We don't actually care what useState thinks the value of the variable
  // is, so we take only the update function from the returned array.
  const mute = rv.onNextChange(useState(value)[1]);
  // Once the component is unmounted, ignore future updates. Note that the
  // useEffect function returns the mute function without calling it,
  // allowing it to be called when the component unmounts. This is
  // equivalent to useEffect(() => () => mute(), []), but shorter.
  useEffect(() => mute, []);
  return value;
}
