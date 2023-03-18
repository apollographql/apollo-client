import { useRef, useState } from 'react';

export function useLazyRef<TValue>(getValue: () => TValue) {
  const [value] = useState(getValue);

  return useRef<TValue>(value);
}
